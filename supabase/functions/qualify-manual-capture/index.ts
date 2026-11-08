import { withSupabase } from 'npm:@supabase/server@^1'

const CLASSIFIER_WEBHOOK = 'https://bharat-2304.app.n8n.cloud/webhook/opportunity-manual-capture-qualification'
const clean = (x: unknown) => typeof x === 'string' ? x.trim() : ''

// The classifier is a model, not a source verifier. Its response is untrusted
// even when the n8n webhook returns HTTP 200. Fail closed on malformed data.
export function validateManualClassification(
  analysis: unknown,
  captureId: string,
  workspaceId: string,
  activeServiceIds: string[]
): Record<string, unknown> {
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis))
    throw new Error('invalid_classifier_response')
  const a = analysis as Record<string, unknown>
  const oneOf = (value: unknown, choices: string[]) =>
    typeof value === 'string' && choices.includes(value)
  if (
    a.capture_id !== captureId || a.workspace_id !== workspaceId ||
    typeof a.is_buyer_request !== 'boolean' ||
    typeof a.confidence !== 'number' || !Number.isFinite(a.confidence) ||
    a.confidence < 0 || a.confidence > 1 ||
    !Number.isInteger(a.intent_level) || (a.intent_level as number) < 1 || (a.intent_level as number) > 4 ||
    typeof a.reason !== 'string' || !a.reason.trim() || a.reason.length > 500 ||
    typeof a.rejection_rule_triggered !== 'boolean' ||
    !oneOf(a.service_match, ['exact', 'related', 'none']) ||
    !oneOf(a.buyer_likelihood, ['strong', 'moderate', 'weak', 'none']) ||
    !oneOf(a.eligibility, ['match', 'mismatch', 'unknown']) ||
    !oneOf(a.source_result_type, [
      'buyer_request', 'marketplace_post', 'full_time_job', 'provider_marketing',
      'informational_content', 'directory_or_listing', 'unknown'
    ]) ||
    a.source_verified !== false ||
    a.provenance !== 'unverified_manual_text'
  ) throw new Error('invalid_classifier_response')

  const serviceId = a.matched_service_id
  if (typeof serviceId !== 'string' ||
    (serviceId !== '' && !activeServiceIds.includes(serviceId)) ||
    (a.service_match === 'none' && serviceId !== '') ||
    (a.service_match !== 'none' && serviceId === '')
  ) throw new Error('invalid_classifier_service_match')

  // A classifier may disagree with itself. Such outputs must be treated as
  // technical failures, not silently converted into accepted opportunities.
  if (a.is_buyer_request === true &&
    !['buyer_request', 'marketplace_post'].includes(a.source_result_type as string))
    throw new Error('inconsistent_classifier_buyer_type')

  return a
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 })
    const body = await req.json().catch(() => ({}))
    const workspaceId = clean(body?.workspace_id)
    const captureId = clean(body?.capture_id)
    const userId = clean(ctx.jwtClaims?.sub)
    if (!workspaceId || !captureId || !userId)
      return Response.json({ error: 'workspace_capture_and_auth_required' }, { status: 400 })

    // All reads use the signed-in user's JWT/RLS; admin is used only after ownership verified.
    const { data: workspace, error: workspaceError } = await ctx.supabase
      .from('workspaces').select('id').eq('id', workspaceId).maybeSingle()
    if (workspaceError || !workspace) return Response.json({ error: 'workspace_not_authorized' }, { status: 403 })

    const { data: capture, error: captureError } = await ctx.supabase.from('manual_capture_reviews')
      .select('id,workspace_id,status,title,requirement,source_url,source_platform')
      .eq('workspace_id', workspaceId).eq('id', captureId).maybeSingle()
    if (captureError || !capture) return Response.json({ error: 'capture_not_authorized' }, { status: 403 })
    if (capture.status !== 'pending_qualification')
      return Response.json({ error: 'capture_not_pending', status: capture.status }, { status: 409 })

    const [profileResult, servicesResult] = await Promise.all([
      ctx.supabase.from('business_profiles')
        .select('primary_goal,business_type,rejection_rules,provider_country,working_languages')
        .eq('workspace_id', workspaceId).limit(1).maybeSingle(),
      ctx.supabase.from('services')
        .select('id,name,description,keywords,active')
        .eq('workspace_id', workspaceId).eq('active', true).limit(25)
    ])
    if (profileResult.error || servicesResult.error || !profileResult.data ||
      !Array.isArray(servicesResult.data) || servicesResult.data.length === 0)
      return Response.json({
        error: 'business_context_incomplete',
        message: 'Set up a Business Profile and at least one active service before running qualification.'
      }, { status: 422 })

    const secret = Deno.env.get('N8N_WEBHOOK_SECRET')
    if (!secret) return Response.json({ error: 'classifier_not_configured' }, { status: 503 })

    // Atomic claim: the server checks real owner_user_id and disallows double work.
    const { data: claimed, error: claimError } = await ctx.supabaseAdmin.rpc(
      'claim_manual_capture_qualification', {
        p_workspace_id: workspaceId, p_capture_id: captureId, p_user_id: userId
      })
    if (claimError || !claimed?.qualification_lease)
      return Response.json({ error: 'capture_claim_failed', message: 'Capture is not available for processing.' }, { status: 409 })

    const lease = claimed.qualification_lease
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45000)
    try {
      const aiResponse = await fetch(CLASSIFIER_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-opportunity-engine-key': secret },
        body: JSON.stringify({
          workspace_id: workspaceId,
          capture_id: captureId,
          candidate: {
            title: capture.title,
            requirement: capture.requirement,
            source_url: capture.source_url,
            source_platform: capture.source_platform
          },
          profile: profileResult.data,
          services: servicesResult.data.map((service: Record<string, unknown>) => ({
            id: service.id,
            name: service.name,
            description: service.description,
            keywords: service.keywords
          }))
        }),
        signal: controller.signal
      })
      if (!aiResponse.ok) throw new Error('model_service_unavailable')
      const classification = validateManualClassification(
        await aiResponse.json(), captureId, workspaceId,
        servicesResult.data.map((service: { id: string }) => service.id)
      )

      const { data: outcome, error: finishError } = await ctx.supabaseAdmin.rpc(
        'finish_manual_capture_qualification', {
          p_workspace_id: workspaceId, p_capture_id: captureId,
          p_lease: lease, p_analysis: classification
        })
      if (finishError || !outcome) throw new Error('qualification_commit_failed')
      return Response.json({ success: true, ...outcome })
    } catch (error) {
      console.error('manual_capture_worker_failure', {
        error: error instanceof Error ? error.message : 'unknown',
        workspace_id: workspaceId, capture_id: captureId
      })
      const { error: failError } = await ctx.supabaseAdmin.rpc(
        'fail_manual_capture_qualification', {
          p_workspace_id: workspaceId, p_capture_id: captureId,
          p_lease: lease, p_reason: error instanceof Error ? error.message : 'worker_failed'
        })
      if (failError) console.error('manual_capture_failure_recording_failed', failError.message)
      return Response.json({
        success: false,
        error: 'qualification_failed',
        message: 'Qualification could not be completed. No buyer outreach was started.'
      }, { status: 502 })
    } finally {
      clearTimeout(timeout)
    }
  })
}
