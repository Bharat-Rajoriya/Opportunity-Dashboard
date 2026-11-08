import { withSupabase } from 'npm:@supabase/server@^1'

const clean = (x: unknown) => typeof x === 'string' ? x.trim() : ''

// Recovery is user-initiated and strictly non-billable. It can only expire
// an already stale lease; it never requeues or runs the classifier.
export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST')
      return Response.json({ error: 'method_not_allowed' }, { status: 405 })
    const payload = await req.json().catch(() => ({}))
    const workspaceId = clean(payload?.workspace_id)
    const captureId = clean(payload?.capture_id)
    const userId = clean(ctx.jwtClaims?.sub)
    if (!workspaceId || !captureId || !userId)
      return Response.json({ error: 'authentication_and_capture_required' }, { status: 400 })

    const { data: workspace, error: workspaceError } = await ctx.supabase
      .from('workspaces').select('id').eq('id',workspaceId).eq('active',true).maybeSingle()
    if (workspaceError || !workspace)
      return Response.json({ error: 'workspace_not_authorized' }, { status: 403 })

    const { data: capture, error: captureError } = await ctx.supabase
      .from('manual_capture_reviews').select('id,status,qualification_started_at')
      .eq('workspace_id',workspaceId).eq('id',captureId).maybeSingle()
    if (captureError || !capture)
      return Response.json({ error: 'capture_not_authorized' }, { status: 403 })
    if (capture.status !== 'qualifying')
      return Response.json({ error: 'capture_not_qualifying' }, { status: 409 })

    const { data, error } = await ctx.supabaseAdmin.rpc(
      'expire_stalled_manual_capture_qualification', {
        p_workspace_id: workspaceId, p_capture_id: captureId,
        p_user_id: userId,
      }
    )
    if (error) {
      const stillRunning = error.message?.includes('qualification_lease_not_expired')
      console.error('manual_capture_stale_recovery_denied', {
        reason: stillRunning ? 'lease_active' : 'recovery_denied',
        capture_id:captureId
      })
      return Response.json({
        error: stillRunning ? 'qualification_lease_not_expired' : 'recovery_denied',
        message: stillRunning
          ? 'Qualification is still within its protected processing window. Refresh later if it remains stuck.'
          : 'Unable to resolve the capture. Refresh the queue before retrying.'
      }, { status: stillRunning ? 409 : 403 })
    }
    if (!data || data.status !== 'failed' || data.retry_scheduled !== false)
      return Response.json({error:'recovery_not_confirmed'}, {status:502})
    return Response.json({
      success:true,status:'failed',retry_scheduled:false,
      message:'Stalled qualification marked failed. No AI rerun or outreach was started.'
    })
  })
}
