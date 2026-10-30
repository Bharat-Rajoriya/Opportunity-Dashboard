import { supabase } from '../lib/supabase'

const LABELS = {
  evaluated: 'Evaluated',
  rejected: 'Rejected',
  qualified: 'Qualified',
  duplicate: 'Already saved',
  created: 'Newly saved',
}

export async function fetchDiscoveryRunDiagnostics(workspaceId, masterExecutionId) {
  if (!workspaceId || !masterExecutionId) return null

  const { data, error } = await supabase
    .from('source_candidate_events')
    .select('source,event_type,gate_reason')
    .eq('workspace_id', workspaceId)
    .eq('master_execution_id', String(masterExecutionId))
    .limit(2000)

  if (error) throw error

  const counts = { evaluated: 0, rejected: 0, qualified: 0, duplicate: 0, created: 0 }
  const sourceCounts = {}
  const reasons = {}

  for (const item of data || []) {
    if (!(item.event_type in counts)) continue
    counts[item.event_type] += 1
    const source = item.source || 'other'
    sourceCounts[source] ??= { evaluated: 0, rejected: 0, qualified: 0, duplicate: 0, created: 0 }
    sourceCounts[source][item.event_type] += 1
    if (item.event_type === 'rejected') {
      const reason = item.gate_reason || 'unclassified'
      reasons[reason] = (reasons[reason] || 0) + 1
    }
  }

  return { counts, sourceCounts, reasons, truncated: (data || []).length >= 2000 }
}

export function discoveryRunExplanation(diagnostics, enabledSources = []) {
  if (!diagnostics) return 'Run details are unavailable; review your active sources and search queries in Settings.'
  const { counts, reasons } = diagnostics
  if (counts.created) return 'New opportunities were saved. Check your opportunity list below.'
  if (counts.duplicate && !counts.created)
    return 'Previously saved opportunities were encountered. Try new search terms or run again when new projects are posted.'
  if (counts.evaluated === 0)
    return 'No candidates reached evaluation. Check that discovery sources and search queries are enabled in Settings.'
  if (counts.rejected > 0) {
    const leading = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (leading === 'ai_not_opportunity')
      return 'Candidates were found, but the classifier did not identify a matching buyer request. Refine your service keywords or enable another available source in Settings.'
    return 'Candidates were reviewed, but none passed your relevance and eligibility checks. Review services, budget thresholds and source settings.'
  }
  return enabledSources.length === 1
    ? 'No new matching leads were saved. Consider enabling another available source in Settings.'
    : 'No new matching leads were saved in this run. Try another search later.'
}

export { LABELS as DISCOVERY_EVENT_LABELS }
