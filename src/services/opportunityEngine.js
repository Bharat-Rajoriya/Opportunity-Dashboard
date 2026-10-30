import { supabase } from '../lib/supabase'

export async function getLatestEngineRun(workspaceId) {
  const { data, error } = await supabase
    .from('engine_runs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

export async function triggerOpportunityEngine(workspaceId) {
  const { data, error } = await supabase.functions.invoke(
    'run-opportunity-engine',
    {
      body: {
        workspace_id: workspaceId,
      },
    }
  )

  if (error) {
    let functionError = null

    try {
      if (error?.context?.clone) {
        functionError = await error.context.clone().json()
      } else if (error?.context?.json) {
        functionError = await error.context.json()
      }
    } catch {
      functionError = null
    }

    if (functionError?.error === 'run_cooldown_active') {
      const retryAfterSeconds = Number(
        functionError.retry_after_seconds || 0
      )

      const retryMinutes = Math.max(
        1,
        Math.ceil(retryAfterSeconds / 60)
      )

      throw new Error(
        `A search was run recently. Try again in about ${retryMinutes} ${retryMinutes === 1 ? 'minute' : 'minutes'}.`
      )
    }

    if (functionError?.error === 'run_already_in_progress') {
      throw new Error(
        'An opportunity search is already running for this workspace.'
      )
    }

    throw error
  }

  if (!data?.success) {
    throw new Error(
      data?.message ||
        data?.error ||
        'Unable to start opportunity search.'
    )
  }

  return data
}

export async function triggerAiQueryGeneration(workspaceId) {
  const { data, error } = await supabase.functions.invoke(
    'generate-search-queries',
    {
      body: {
        workspace_id: workspaceId,
      },
    }
  )

  if (error) throw error

  if (!data?.success) {
    throw new Error(
      data?.message ||
        data?.error ||
        'Unable to regenerate AI search queries.'
    )
  }

  return data
}


export async function generateOnboardingCopy({
  workspaceId,
  fieldType,
  roughText,
  context,
}) {
  const { data, error } = await supabase.functions.invoke(
    'generate-onboarding-copy',
    {
      body: {
        workspace_id: workspaceId,
        field_type: fieldType,
        rough_text: roughText,
        context,
      },
    }
  )

  if (error) throw error

  const hasGeneratedFilters =
    Array.isArray(data?.ideal_client_types) &&
      data.ideal_client_types.length > 0 ||
    Array.isArray(data?.rejection_rules) &&
      data.rejection_rules.length > 0

  if (!data?.success || (!data?.generated_text && !hasGeneratedFilters)) {
    throw new Error(
      data?.message ||
        data?.error ||
        'Unable to generate AI-assisted onboarding copy.'
    )
  }

  return data
}


export async function generateOpportunityPitch({
  workspaceId,
  opportunityId,
}) {
  const { data, error } = await supabase.functions.invoke(
    'generate-opportunity-pitch',
    {
      body: {
        workspace_id: workspaceId,
        opportunity_id: opportunityId,
      },
    }
  )

  if (error) throw error

  if (!data?.success) {
    throw new Error(
      data?.message ||
        data?.error ||
        'Unable to generate outreach for this opportunity.'
    )
  }

  return data
}
