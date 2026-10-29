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
}) {
  const payload = {
    search_queries: normalizeSearchList(searchQueries),
    target_countries: normalizeSearchList(targetCountries),
    min_intent_level: Number(minIntentLevel),
    max_age_hours: Number(maxAgeHours),
    ai_query_generation_enabled: Boolean(aiQueryGenerationEnabled),
    query_batch_size: Number(queryBatchSize),
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
