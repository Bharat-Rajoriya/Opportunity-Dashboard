import { supabase } from '../lib/supabase'

export const SAVED_SEARCH_FIELDS = 'id,workspace_id,name,query,source,recency,min_score,country,created_at,updated_at'

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
