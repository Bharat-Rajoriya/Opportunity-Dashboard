import { withSupabase } from 'npm:@supabase/server@^1'

const N8N_QUERY_WEBHOOK_URL =
  'https://bharat-2304.app.n8n.cloud/webhook/opportunity-query-generate'

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

        // Verify workspace access using the signed-in user's
        // auth context and existing RLS policies.
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

        // Confirm there is an active search profile and
        // AI query generation is enabled for this workspace.
        const {
          data: searchProfile,
          error: searchProfileError,
        } = await ctx.supabase
          .from('search_profiles')
          .select(
            'id, ai_query_generation_enabled, ai_queries_generated_at',
          )
          .eq('workspace_id', workspaceId)
          .eq('active', true)
          .limit(1)
          .maybeSingle()

        if (searchProfileError) {
          console.error(
            'Search profile lookup error:',
            searchProfileError,
          )

          return Response.json(
            {
              success: false,
              error: 'search_profile_lookup_failed',
            },
            { status: 500 },
          )
        }

        if (!searchProfile) {
          return Response.json(
            {
              success: false,
              error: 'active_search_profile_not_found',
            },
            { status: 404 },
          )
        }

        if (
          searchProfile.ai_query_generation_enabled !== true
        ) {
          return Response.json(
            {
              success: false,
              error: 'ai_query_generation_disabled',
            },
            { status: 409 },
          )
        }

        const webhookSecret =
          Deno.env.get('N8N_WEBHOOK_SECRET')

        if (!webhookSecret) {
          console.error(
            'Missing N8N_WEBHOOK_SECRET',
          )

          return Response.json(
            {
              success: false,
              error: 'query_generator_configuration_missing',
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

        const n8nResponse = await fetch(
          N8N_QUERY_WEBHOOK_URL,
          {
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
              trigger_source: 'dashboard',
            }),
          },
        )

        const responseText =
          await n8nResponse.text()

        if (!n8nResponse.ok) {
          console.error(
            'n8n rejected query generation request:',
            n8nResponse.status,
            responseText,
          )

          return Response.json(
            {
              success: false,
              error: 'query_generation_trigger_failed',
              status: n8nResponse.status,
            },
            { status: 502 },
          )
        }

        let n8nResult = null

        try {
          n8nResult = responseText
            ? JSON.parse(responseText)
            : null
        } catch {
          n8nResult = responseText || null
        }

        return Response.json(
          {
            success: true,
            accepted: true,
            workspace_id: workspaceId,
            search_profile_id: searchProfile.id,
            message:
              'AI search query regeneration started.',
            n8n: n8nResult,
          },
          { status: 202 },
        )
      } catch (error) {
        console.error(
          'generate-search-queries error:',
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
