import { supabase } from '../lib/supabase'

export const SAVED_SEARCH_FIELDS = 'id,workspace_id,name,query,source,recency,min_score,country,created_at,updated_at,in_app_digest_frequency,digest_started_at,last_reviewed_at'

export function normalizeSavedSearch(input = {}) {
  const name = String(input.name || '').trim().slice(0, 80)
  const query = String(input.query || '').trim().slice(0, 500)
  const source = String(input.source || 'all').slice(0, 80)
  const country = String(input.country || 'all').slice(0, 120)
  const recency = ['all', '24', '168', '720'].includes(String(input.recency)) ? String(input.recency) : 'all'
  const min_score = ['all', '60', '70', '80'].includes(String(input.min_score)) ? String(input.min_score) : 'all'
  return { name, query, source, recency, min_score, country }
}

export async function loadSavedSearches(workspaceId) {
  if (!workspaceId) throw new Error('Workspace is required.')
  const { data, error } = await supabase.from('saved_opportunity_searches')
    .select(SAVED_SEARCH_FIELDS).eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createSavedSearch(workspaceId, input) {
  if (!workspaceId) throw new Error('Workspace is required.')
  const value = normalizeSavedSearch(input)
  if (!value.name) throw new Error('Enter a name for this saved search.')
  const { data, error } = await supabase.from('saved_opportunity_searches')
    .insert({ ...value, workspace_id: workspaceId }).select(SAVED_SEARCH_FIELDS).single()
  if (error) throw error
  return data
}

export async function deleteSavedSearch(workspaceId, id) {
  if (!workspaceId || !id) throw new Error('Workspace and saved search are required.')
  const { error } = await supabase.from('saved_opportunity_searches')
    .delete().eq('workspace_id', workspaceId).eq('id', id)
  if (error) throw error
}

/**
 * In-app only. Choosing a frequency never schedules a job or sends a message.
 * Enabling starts from now, so old records cannot create a misleading backlog.
 */
export async function setInAppDigestFrequency(workspaceId, id, frequency) {
  if (!workspaceId || !id) throw new Error('Workspace and saved search are required.')
  if (!['off', 'daily', 'weekly'].includes(frequency)) throw new Error('Invalid digest frequency.')
  const updates = { in_app_digest_frequency: frequency, updated_at: new Date().toISOString() }
  if (frequency !== 'off') {
    const now = new Date().toISOString()
    // A caller changing from off to an enabled state resets the starting window.
    // Existing enabled preferences retain their review cursor.
    const { data: current, error: readError } = await supabase.from('saved_opportunity_searches')
      .select('in_app_digest_frequency').eq('workspace_id', workspaceId).eq('id', id).single()
    if (readError) throw readError
    if (current.in_app_digest_frequency === 'off') {
      updates.digest_started_at = now
      updates.last_reviewed_at = now
    }
  }
  const { data, error } = await supabase.from('saved_opportunity_searches')
    .update(updates).eq('workspace_id', workspaceId).eq('id', id)
    .select(SAVED_SEARCH_FIELDS).single()
  if (error) throw error
  return data
}

export async function markInAppDigestReviewed(workspaceId, id) {
  if (!workspaceId || !id) throw new Error('Workspace and saved search are required.')
  const { data, error } = await supabase.from('saved_opportunity_searches')
    .update({ last_reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId).eq('id', id).neq('in_app_digest_frequency', 'off')
    .select(SAVED_SEARCH_FIELDS).single()
  if (error) throw error
  return data
}

// Mirrors the read-only Unified Search filters. No external acquisition calls.
export function matchesSavedSearchOpportunity(row, saved, now = Date.now()) {
  const needle = String(saved.query || '').trim().toLowerCase()
  if (needle) {
    const text = [row.title, row.requirement, row.raw_text, row.source, row.company_name, row.country]
      .filter(Boolean).join(' ').toLowerCase()
    if (!text.includes(needle)) return false
  }
  if (saved.source !== 'all' && String(row.source || '').toLowerCase() !== String(saved.source || '').toLowerCase()) return false
  if (saved.country !== 'all' && String(row.country || '') !== saved.country) return false
  if (saved.min_score !== 'all' && Number(row.total_score ?? row.preliminary_score ?? 0) < Number(saved.min_score)) return false
  if (saved.recency !== 'all') {
    const posted = row.published_at ? Date.parse(row.published_at) : NaN
    if (!Number.isFinite(posted) || posted < now - Number(saved.recency) * 3600000) return false
  }
  return true
}

export function digestWindowStart(saved, now = Date.now()) {
  if (!['daily', 'weekly'].includes(saved.in_app_digest_frequency)) return null
  const windowStart = now - (saved.in_app_digest_frequency === 'daily' ? 24 : 168) * 3600000
  const timestamps = [windowStart, saved.digest_started_at && Date.parse(saved.digest_started_at),
    saved.last_reviewed_at && Date.parse(saved.last_reviewed_at)]
    .filter(value => Number.isFinite(value) && value > 0)
  return new Date(Math.max(...timestamps)).toISOString()
}

export async function fetchInAppDigest(workspaceId, saved) {
  if (!workspaceId || !saved?.id || saved.workspace_id !== workspaceId) throw new Error('Invalid workspace or saved search.')
  const since = digestWindowStart(saved)
  if (!since) return { matches: [], truncated: false, since: null }
  // Limit reads; never make unbounded full-workspace scans. Incomplete windows
  // are explicitly labelled rather than pretending the count is exact.
  const { data, error } = await supabase.from('opportunities')
    .select('id,title,requirement,raw_text,source,country,company_name,total_score,preliminary_score,published_at,created_at,source_url')
    .eq('workspace_id', workspaceId).gte('created_at', since)
    .order('created_at', { ascending: false }).range(0, 1000)
  if (error) throw error
  const rows = data || []
  return { matches: rows.filter(item => matchesSavedSearchOpportunity(item, saved)), truncated: rows.length > 1000, since }
}
