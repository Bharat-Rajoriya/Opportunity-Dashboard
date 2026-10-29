import { withSupabase } from 'npm:@supabase/server@^1'

const N8N_MANUAL_PITCH_WEBHOOK_URL =
  'https://bharat-2304.app.n8n.cloud/webhook/opportunity-manual-pitch'

function cleanString(value: unknown, maxLength = 500) {
  return typeof value === 'string'
    ? value.trim().slice(0, maxLength)
    : ''
}

export default {
  fetch: withSupabase(
    { auth: 'user' },

    async (req, ctx) => {
      try {
        if (req.method !== 'POST') {
          return Response.json(
            { success: false, error: 'method_not_allowed' },
            { status: 405 },
          )
        }

        const body = await req.json().catch(() => ({}))
        const workspaceId = cleanString(body.workspace_id, 100)
        const opportunityId = cleanString(body.opportunity_id, 100)

        if (!workspaceId || !opportunityId) {
          return Response.json(
            {
              success: false,
              error: 'workspace_and_opportunity_required',
            },
            { status: 400 },
          )
        }

        const {
          data: opportunity,
          error: opportunityError,
        } = await ctx.supabase
          .from('opportunities')
          .select('id, workspace_id, outreach_status')
          .eq('id', opportunityId)
          .eq('workspace_id', workspaceId)
          .maybeSingle()

        if (opportunityError) {
          console.error(
            'Manual pitch opportunity verification failed:',
            opportunityError,
          )

          return Response.json(
            {
              success: false,
              error: 'opportunity_verification_failed',
            },
            { status: 500 },
          )
        }

        if (!opportunity) {
          return Response.json(
            {
              success: false,
              error: 'opportunity_not_found_or_unauthorized',
            },
            { status: 403 },
          )
        }

        if (
          opportunity.outreach_status &&
          opportunity.outreach_status !== 'not_generated'
        ) {
          return Response.json(
            {
              success: false,
              error: 'outreach_already_exists',
              message:
                'This opportunity already has an outreach draft.',
            },
            { status: 409 },
          )
        }

        const requestedByUserId =
          String(ctx.jwtClaims?.sub ?? '').trim()

        if (!requestedByUserId) {
          return Response.json(
            {
              success: false,
              error: 'authenticated_user_missing',
            },
            { status: 401 },
          )
        }

        const webhookSecret =
          Deno.env.get('N8N_WEBHOOK_SECRET')

        if (!webhookSecret) {
          return Response.json(
            {
              success: false,
              error: 'manual_pitch_configuration_missing',
            },
            { status: 500 },
          )
        }

        const n8nResponse = await fetch(
          N8N_MANUAL_PITCH_WEBHOOK_URL,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-opportunity-engine-key': webhookSecret,
            },
            body: JSON.stringify({
              workspace_id: workspaceId,
              opportunity_id: opportunityId,
              requested_by_user_id: requestedByUserId,
              trigger_source: 'dashboard_manual_pitch',
            }),
          },
        )

        const responseText = await n8nResponse.text()

        if (!n8nResponse.ok) {
          return Response.json(
            {
              success: false,
              error: 'manual_pitch_generation_failed',
              status: n8nResponse.status,
            },
            { status: 502 },
          )
        }

        let result: Record<string, unknown> = {}

        try {
          result = responseText
            ? JSON.parse(responseText)
            : {}
        } catch {
          result = {}
        }

        if (result.success !== true) {
          return Response.json(
            {
              success: false,
              error: 'manual_pitch_generation_failed',
            },
            { status: 502 },
          )
        }

        return Response.json({
          success: true,
          opportunity_id: opportunityId,
          outreach_status: result.outreach_status ?? 'drafted',
          outreach_review_status:
            result.outreach_review_status ?? 'pending_review',
          generated_at: result.generated_at ?? null,
        })
      } catch (error) {
        console.error('generate-opportunity-pitch error:', error)

        return Response.json(
          {
            success: false,
            error: 'unexpected_error',
            message:
              error instanceof Error
                ? error.message
                : 'Unknown error',
          },
          { status: 500 },
        )
      }
    },
  ),
}
