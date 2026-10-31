import { supabase } from '../lib/supabase'

export const SEARCH_PROFILE_FIELDS = `
  id,
  workspace_id,
  name,
  source,
  search_queries,
  target_countries,
  min_intent_level,
  max_age_hours,
  active,
  ai_suggested_queries,
  ai_query_generation_enabled,
  ai_queries_generated_at,
  query_cursor,
  query_batch_size,
  enabled_sources,
  source_preferences,
  updated_at
`

export function normalizeSourceKeys(items) {
  const allowed = new Set([
    'google',
    'freelancer',
    'upwork',
    'reddit',
    'peopleperhour',
  ])

  const normalized = normalizeSearchList(items)
    .map((item) => item.toLowerCase())
    .filter((item) => allowed.has(item))

  return normalized.length > 0
    ? normalized
    : ['google']
}

export function normalizeSourcePreferences(value) {
  const preferences =
    value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {}

  const freelancer =
    preferences.freelancer &&
    typeof preferences.freelancer === 'object' &&
    !Array.isArray(preferences.freelancer)
      ? preferences.freelancer
      : {}

  const requestedLimit = Number(
    freelancer.result_limit ?? freelancer.limit ?? 10
  )

  const resultLimit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(50, Math.round(requestedLimit)))
    : 10

  return {
    freelancer: {
      result_limit: resultLimit,
    },
  }
}

export function normalizeSearchList(items) {
  if (!Array.isArray(items)) return []

  const seen = new Set()

  return items
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase()

      if (!item || seen.has(key)) return false

      seen.add(key)
      return true
    })
}

export async function fetchActiveSearchProfile(workspaceId) {
  const { data, error } = await supabase
    .from('search_profiles')
    .select(SEARCH_PROFILE_FIELDS)
    .eq('workspace_id', workspaceId)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

export async function saveActiveSearchProfile({
  profileId,
  workspaceId,
  searchQueries,
  targetCountries,
  minIntentLevel,
  maxAgeHours,
  aiQueryGenerationEnabled,
  queryBatchSize,
  enabledSources,
  sourcePreferences,
}) {
  const payload = {
    search_queries: normalizeSearchList(searchQueries),
    target_countries: normalizeSearchList(targetCountries),
    min_intent_level: Number(minIntentLevel),
    max_age_hours: Number(maxAgeHours),
    ai_query_generation_enabled: Boolean(aiQueryGenerationEnabled),
    query_batch_size: Number(queryBatchSize),
    enabled_sources: normalizeSourceKeys(enabledSources),
    source_preferences: normalizeSourcePreferences(sourcePreferences),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('search_profiles')
    .update(payload)
    .eq('id', profileId)
    .eq('workspace_id', workspaceId)
    .select(SEARCH_PROFILE_FIELDS)
    .single()

  if (error) throw error
  return data
}


export async function fetchSearchProfileById({
  profileId,
  workspaceId,
}) {
  const { data, error } = await supabase
    .from('search_profiles')
    .select(SEARCH_PROFILE_FIELDS)
    .eq('id', profileId)
    .eq('workspace_id', workspaceId)
    .single()

  if (error) throw error
  return data
}

/**
 * Explicit opt-in to production Freelancer search. Only the source list is
 * changed; unsaved query, budget or geography preferences are not overwritten.
 */
export async function enableFreelancerDiscovery({ profileId, workspaceId }) {
  if (!profileId || !workspaceId) {
    throw new Error('An active workspace and search profile are required.')
  }

  const { data: current, error: readError } = await supabase
    .from('search_profiles')
    .select('id,workspace_id,enabled_sources')
    .eq('id', profileId)
    .eq('workspace_id', workspaceId)
    .single()

  if (readError) throw readError
  if (!current?.id || current.workspace_id !== workspaceId) {
    throw new Error('Search profile could not be verified.')
  }

  const sources = normalizeSourceKeys(current.enabled_sources)
  if (sources.includes('freelancer')) {
    return fetchSearchProfileById({ profileId, workspaceId })
  }

  const { data, error } = await supabase
    .from('search_profiles')
    .update({
      enabled_sources: [...sources, 'freelancer'],
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .eq('workspace_id', workspaceId)
    .select(SEARCH_PROFILE_FIELDS)
    .single()

  if (error) throw error
  if (!data?.id || data.workspace_id !== workspaceId) {
    throw new Error('Freelancer source update could not be verified.')
  }
  return data
}
