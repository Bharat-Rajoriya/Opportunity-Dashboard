import { withSupabase } from 'npm:@supabase/server@^1'

export default {
  fetch: withSupabase(
    { auth: 'user' },

    async (req, ctx) => {
      try {
        if (req.method !== 'POST') {
          return Response.json(
            {
              success: false,
              error: 'method_not_allowed',
            },
            { status: 405 },
          )
        }

        const body = await req.json().catch(() => ({}))

        const workspaceId =
          typeof body.workspace_id === 'string'
            ? body.workspace_id.trim()
            : ''

        if (!workspaceId) {
          return Response.json(
            {
              success: false,
              error: 'workspace_id_required',
            },
            { status: 400 },
          )
        }

        // --------------------------------------------------
        // 1. Verify the signed-in user can access workspace.
        // ctx.supabase uses the user's JWT + your RLS rules.
        // --------------------------------------------------

        const {
          data: workspace,
          error: workspaceError,
        } = await ctx.supabase
          .from('workspaces')
          .select('id')
          .eq('id', workspaceId)
          .maybeSingle()

        if (workspaceError) {
          console.error(
            'Workspace verification error:',
            workspaceError,
          )

          return Response.json(
            {
              success: false,
              error: 'workspace_verification_failed',
            },
            { status: 500 },
          )
        }

        if (!workspace) {
          return Response.json(
            {
              success: false,
              error: 'workspace_not_found_or_unauthorized',
            },
            { status: 403 },
          )
        }

        // --------------------------------------------------
        // 2. Prevent accidental duplicate expensive runs.
        // Only consider recent running executions.
        // --------------------------------------------------

        const runningSince = new Date(
          Date.now() - 30 * 60 * 1000,
        ).toISOString()

        const {
          data: existingRun,
          error: existingRunError,
        } = await ctx.supabaseAdmin
          .from('engine_runs')
          .select(
            `
              id,
              workspace_id,
              master_execution_id,
              run_started_at,
              run_status,
              created_at
            `,
          )
          .eq('workspace_id', workspaceId)
          .eq('run_status', 'running')
          .gte('created_at', runningSince)
          .order('created_at', {
            ascending: false,
          })
          .limit(1)
          .maybeSingle()

        if (existingRunError) {
          console.error(
            'Engine run lookup error:',
            existingRunError,
          )

          return Response.json(
            {
              success: false,
              error: 'run_status_check_failed',
            },
            { status: 500 },
          )
        }

        if (existingRun) {
          return Response.json(
            {
              success: false,
              error: 'run_already_in_progress',
              message:
                'An opportunity search is already running.',
              run: existingRun,
            },
            { status: 409 },
          )
        }

        // --------------------------------------------------
        // 3. Enforce a short manual-run cooldown.
        //
        // This is server-side so refreshing the browser, opening
        // another tab, or calling the function directly cannot
        // bypass the protection.
        // --------------------------------------------------

        const manualCooldownMs = 10 * 60 * 1000

        const {
          data: latestRun,
          error: latestRunError,
        } = await ctx.supabaseAdmin
          .from('engine_runs')
          .select(
            `
              id,
              workspace_id,
              master_execution_id,
              run_started_at,
              run_finished_at,
              run_status,
              created_at
            `,
          )
          .eq('workspace_id', workspaceId)
          .order('created_at', {
            ascending: false,
          })
          .limit(1)
          .maybeSingle()

        if (latestRunError) {
          console.error(
            'Latest engine run lookup error:',
            latestRunError,
          )

          return Response.json(
            {
              success: false,
              error: 'run_cooldown_check_failed',
            },
            { status: 500 },
          )
        }

        if (latestRun) {
          const latestRunAtRaw =
            latestRun.run_finished_at ||
            latestRun.run_started_at ||
            latestRun.created_at

          const latestRunAt = latestRunAtRaw
            ? new Date(latestRunAtRaw).getTime()
            : Number.NaN

          if (Number.isFinite(latestRunAt)) {
            const elapsedMs = Date.now() - latestRunAt

            if (
              elapsedMs >= 0 &&
              elapsedMs < manualCooldownMs
            ) {
              const retryAfterSeconds = Math.max(
                1,
                Math.ceil(
                  (manualCooldownMs - elapsedMs) / 1000,
                ),
              )

              return Response.json(
                {
                  success: false,
                  error: 'run_cooldown_active',
                  message:
                    'Please wait a few minutes before starting another opportunity search.',
                  retry_after_seconds:
                    retryAfterSeconds,
                  cooldown_seconds:
                    Math.floor(manualCooldownMs / 1000),
                  last_run: latestRun,
                },
                {
                  status: 429,
                  headers: {
                    'Retry-After':
                      String(retryAfterSeconds),
                  },
                },
              )
            }
          }
        }

        // --------------------------------------------------
        // 4. Read private server-side configuration.
        // --------------------------------------------------

        const webhookUrl =
          Deno.env.get('N8N_WEBHOOK_URL')

        const webhookSecret =
          Deno.env.get('N8N_WEBHOOK_SECRET')

        if (!webhookUrl || !webhookSecret) {
          console.error(
            'Missing n8n Edge Function secrets',
          )

          return Response.json(
            {
              success: false,
              error: 'engine_configuration_missing',
            },
            { status: 500 },
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

        // --------------------------------------------------
        // 5. Trigger the protected n8n production workflow.
        // --------------------------------------------------

        const n8nResponse = await fetch(webhookUrl, {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'x-opportunity-engine-key':
              webhookSecret,
          },

          body: JSON.stringify({
            workspace_id: workspaceId,
            user_id: requestedByUserId,
            requested_by_user_id:
              requestedByUserId,
            run_source: 'manual',
          }),
        })

        if (!n8nResponse.ok) {
          const responseText =
            await n8nResponse.text()

          console.error(
            'n8n rejected engine request:',
            n8nResponse.status,
            responseText,
          )

          return Response.json(
            {
              success: false,
              error: 'engine_trigger_failed',
              status: n8nResponse.status,
            },
            { status: 502 },
          )
        }

        // --------------------------------------------------
        // 6. Return immediately.
        // n8n continues the actual engine in background.
        // --------------------------------------------------

        return Response.json(
          {
            success: true,
            accepted: true,
            workspace_id: workspaceId,
            run_source: 'manual',
            message:
              'Opportunity search started.',
          },
          {
            status: 202,
          },
        )
      } catch (error) {
        console.error(
          'run-opportunity-engine error:',
          error,
        )

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