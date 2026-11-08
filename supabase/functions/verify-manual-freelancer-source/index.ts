import { withSupabase } from 'npm:@supabase/server@^1'

const PROVIDER_WEBHOOK = 'https://bharat-2304.app.n8n.cloud/webhook/opportunity-freelancer-project-verify'
const clean = (value: unknown) => typeof value === 'string' ? value.trim() : ''

// Only project-id-based Freelancer URLs are supported. Never fetch a user URL.
export function freelancerProjectId(source: string): string | null {
  try {
    const u = new URL(source)
    if (u.protocol !== 'https:' || !['www.freelancer.com','freelancer.com'].includes(u.hostname.toLowerCase()) ||
      u.username || u.password || u.port) return null
    if (!u.pathname.startsWith('/projects/')) return null
    const end = u.pathname.replace(/\/+$/, '').split('/').pop() || ''
    const match = end.match(/(?:^|-)([1-9][0-9]{3,11})$/)
    return match?.[1] || null
  } catch { return null }
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 })
    const body = await req.json().catch(() => ({}))
    const workspaceId = clean(body?.workspace_id)
    const captureId = clean(body?.capture_id)
    if (!workspaceId || !captureId || !clean(ctx.jwtClaims?.sub))
      return Response.json({ error: 'authentication_and_capture_required' }, { status: 400 })

    // All reads use the signed-in user's RLS client. Do not accept URL or
    // project ID from the frontend; load the persisted source.
    const { data: workspace, error: workspaceErr } = await ctx.supabase
      .from('workspaces').select('id').eq('id', workspaceId).maybeSingle()
    if (workspaceErr || !workspace)
      return Response.json({ error: 'workspace_not_authorized' }, { status: 403 })

    const { data: capture, error: captureErr } = await ctx.supabase
      .from('manual_capture_reviews')
      .select('id,workspace_id,status,source_platform,source_url,qualified_opportunity_id')
      .eq('workspace_id', workspaceId).eq('id',captureId).maybeSingle()
    if (captureErr || !capture)
      return Response.json({ error: 'capture_not_authorized' }, { status: 403 })
    if (capture.status !== 'qualified' || capture.source_platform !== 'freelancer' ||
      !capture.qualified_opportunity_id)
      return Response.json({ error: 'capture_not_eligible' }, { status: 422 })

    const projectId = freelancerProjectId(capture.source_url)
    if (!projectId)
      return Response.json({
        error: 'project_id_unavailable',
        message: 'This Freelancer URL does not expose a supported numeric project ID. Review the source manually.'
      }, { status: 422 })

    const secret = Deno.env.get('N8N_WEBHOOK_SECRET')
    if (!secret) return Response.json({ error: 'provider_verifier_not_configured' }, { status: 503 })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)
    try {
      const response = await fetch(PROVIDER_WEBHOOK, {
        method:'POST',
        headers: {'Content-Type':'application/json','x-opportunity-engine-key':secret},
        body:JSON.stringify({workspace_id:workspaceId,capture_id:captureId,project_id:projectId}),
        signal:controller.signal
      })
      if (!response.ok) throw new Error('freelancer_provider_unavailable')
      const raw = await response.json()
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        raw.capture_id !== captureId || raw.workspace_id !== workspaceId ||
        raw.project_id !== projectId || raw.provider !== 'freelancer' ||
        raw.provider_listing_found !== true ||
        raw.buyer_identity_verified !== false || raw.payment_verified !== false ||
        typeof raw.provider_title !== 'string' || !raw.provider_title.trim() ||
        typeof raw.provider_status !== 'string' || !raw.provider_status.trim())
        throw new Error('invalid_provider_evidence')

      const evidence = {
        provider:'freelancer',
        project_id:projectId,
        provider_listing_found:true,
        provider_status:raw.provider_status.slice(0,60),
        provider_title:raw.provider_title.slice(0,180),
        buyer_identity_verified:false,
        payment_verified:false,
        provenance:'official_freelancer_project_api'
      }
      const { data: recorded, error: recordErr } = await ctx.supabaseAdmin.rpc(
        'record_manual_freelancer_provider_check', {
          p_workspace_id:workspaceId,p_capture_id:captureId,
          p_status:'listing_confirmed',p_evidence:evidence
        }
      )
      if (recordErr || recorded?.status !== 'listing_confirmed')
        throw new Error('provider_evidence_commit_failed')
      return Response.json({success:true,status:'listing_confirmed',provider_status:evidence.provider_status,
        provider_title:evidence.provider_title,buyer_identity_verified:false,payment_verified:false,
        message:'Freelancer API returned the listing. Buyer identity, payment and current availability are not verified.'})
    } catch (err) {
      console.error('manual_freelancer_verification_failed',{
        reason:err instanceof Error ? err.message : 'unknown',
        capture_id:captureId, workspace_id:workspaceId
      })
      // Technical provider errors are not proof that the listing disappeared.
      return Response.json({success:false,error:'provider_verification_failed',
        message:'Freelancer listing could not be confirmed. No lead score or outreach was changed.'},
        {status:502})
    } finally { clearTimeout(timeout) }
  })
}
