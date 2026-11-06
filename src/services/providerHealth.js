import { supabase } from '../lib/supabase'

export async function fetchProviderHealth(workspaceId) {
  if (!workspaceId) return null
  const { data, error } = await supabase.rpc('get_provider_health_summary_v1', {
    p_workspace_id: workspaceId,
  })
  if (error) throw error
  if (!data || data.provider !== 'serpapi') {
    throw new Error('Provider status response is unavailable.')
  }
  return data
}

export async function fetchLastRunSourceCounts(workspaceId, masterExecutionId) {
  if (!workspaceId || !masterExecutionId) return {}
  const { data, error } = await supabase
    .from('source_candidate_events')
    .select('source,event_type')
    .eq('workspace_id', workspaceId)
    .eq('master_execution_id', String(masterExecutionId))
    .limit(2000)
  if (error) throw error
  const counts = {}
  for (const item of data || []) {
    const source = String(item?.source || '').toLowerCase()
    const event = String(item?.event_type || '').toLowerCase()
    if (!source || !['evaluated','qualified','created','duplicate','rejected'].includes(event)) continue
    counts[source] ??= { evaluated: 0, qualified: 0, created: 0, duplicate: 0, rejected: 0 }
    counts[source][event] += 1
  }
  return counts
}
