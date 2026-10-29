import { withSupabase } from 'npm:@supabase/server@^1'

const N8N_ONBOARDING_ASSIST_WEBHOOK_URL =
  'https://bharat-2304.app.n8n.cloud/webhook/opportunity-onboarding-assist'

const ALLOWED_FIELD_TYPES = new Set([
  'main_goal',
  'service_description',
  'good_opportunity',
  'profile_filters',
])

function cleanString(value: unknown, maxLength = 8000) {
  return typeof value === 'string'
    ? value.trim().slice(0, maxLength)
    : ''
}

function cleanStringList(value: unknown, maxItems = 12) {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()

  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase()

      if (!item || seen.has(key)) return false

      seen.add(key)
      return true
    })
    .slice(0, maxItems)
}

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

        const workspaceId = cleanString(
          body.workspace_id,
          100,
        )

        const fieldType = cleanString(
          body.field_type,
          100,
        )

        const roughText = cleanString(
          body.rough_text,
          6000,
        )

        const context =
          body.context &&
          typeof body.context === 'object' &&
          !Array.isArray(body.context)
            ? body.context
            : {}

        if (!workspaceId) {
          return Response.json(
            {
              success: false,
              error: 'workspace_id_required',
            },
            { status: 400 },
          )
        }

        if (!ALLOWED_FIELD_TYPES.has(fieldType)) {
          return Response.json(
            {
              success: false,
              error: 'unsupported_field_type',
            },
            { status: 400 },
          )
        }

        if (
          !roughText &&
          Object.keys(context).length === 0
        ) {
          return Response.json(
            {
              success: false,
              error: 'input_required',
              message:
                'Add some details before asking AI to improve this field.',
            },
            { status: 400 },
          )
        }

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
          console.error(
            'Missing N8N_WEBHOOK_SECRET',
          )

          return Response.json(
            {
              success: false,
              error: 'onboarding_assistant_configuration_missing',
            },
            { status: 500 },
          )
        }

        const serializedContext = JSON.stringify(context)

        if (serializedContext.length > 12000) {
          return Response.json(
            {
              success: false,
              error: 'context_too_large',
            },
            { status: 413 },
          )
        }

        const n8nResponse = await fetch(
          N8N_ONBOARDING_ASSIST_WEBHOOK_URL,
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
              field_type: fieldType,
              rough_text: roughText,
              context,
              trigger_source: 'dashboard_onboarding',
            }),
          },
        )

        const responseText =
          await n8nResponse.text()

        if (!n8nResponse.ok) {
          console.error(
            'n8n onboarding assistant failed:',
            n8nResponse.status,
            responseText,
          )

          return Response.json(
            {
              success: false,
              error: 'onboarding_assistant_failed',
              status: n8nResponse.status,
            },
            { status: 502 },
          )
        }

        let n8nResult: unknown = null

        try {
          n8nResult = responseText
            ? JSON.parse(responseText)
            : null
        } catch {
          n8nResult = responseText || null
        }

        const result =
          n8nResult &&
          typeof n8nResult === 'object'
            ? n8nResult as Record<string, unknown>
            : {}

        const generatedText = cleanString(
          result.generated_text,
          8000,
        )

        const idealClientTypes = cleanStringList(
          result.ideal_client_types,
        )

        const rejectionRules = cleanStringList(
          result.rejection_rules,
        )

        if (
          !generatedText &&
          idealClientTypes.length === 0 &&
          rejectionRules.length === 0
        ) {
          return Response.json(
            {
              success: false,
              error: 'empty_ai_response',
            },
            { status: 502 },
          )
        }

        return Response.json({
          success: true,
          field_type: fieldType,
          generated_text: generatedText,
          ideal_client_types: idealClientTypes,
          rejection_rules: rejectionRules,
          confidence:
            typeof result.confidence === 'number'
              ? result.confidence
              : null,
          rationale:
            cleanString(result.rationale, 1000) ||
            null,
        })
      } catch (error) {
        console.error(
          'generate-onboarding-copy error:',
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
