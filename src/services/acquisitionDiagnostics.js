import { supabase } from '../lib/supabase'

const PAGE_LIMIT = 500

export function summarizeAcquisitionRuns(rows = []) {
  const bySource = {}
  const totals = { evaluated: 0, rejected: 0, qualified: 0, created: 0, duplicate: 0 }
  for (const row of rows) {
    const key = String(row.source || 'unknown').toLowerCase()
    const counts = {
      evaluated: Number(row.evaluated_events) || 0,
      rejected: Number(row.rejected_events) || 0,
      qualified: Number(row.qualified_events) || 0,
      created: Number(row.created_events) || 0,
      duplicate: Number(row.duplicate_events) || 0,
    }
    if (!bySource[key]) bySource[key] = { ...totals }
    for (const name of Object.keys(totals)) {
      totals[name] += counts[name]
      bySource[key][name] += counts[name]
    }
  }
  return { totals, bySource }
}

export function explainAcquisitionRun(row) {
  if (!row) return 'No recorded candidate events for this run.'
  const evaluated = Number(row.evaluated_events) || 0
  const qualified = Number(row.qualified_events) || 0
  const created = Number(row.created_events) || 0
  const duplicates = Number(row.duplicate_events) || 0
  if (created > 0) return 'New opportunities saved.'
  if (duplicates > 0 && qualified > 0) return 'Qualified candidates were already saved.'
  if (evaluated === 0) return 'No evaluation events recorded. Check source execution logs.'
  if (qualified === 0) return 'Candidates evaluated, but none qualified. Review rejection reasons.'
  return 'Qualified candidates recorded, but no new saved opportunities. Check persistence and deduplication.'
}

export async function fetchAcquisitionDiagnostics(workspaceId, { days = 30 } = {}) {
  if (!workspaceId) return { runs: [], reasons: [], truncated: false }
  const safeDays = Math.max(1, Math.min(90, Number(days) || 30))
  const since = new Date(Date.now() - safeDays * 86400000).toISOString()
  const [runsResponse, reasonsResponse] = await Promise.all([
    supabase.from('acquisition_run_funnel_v1').select('*')
      .eq('workspace_id', workspaceId)
      .gte('last_event_at', since)
      .order('last_event_at', { ascending: false }).limit(PAGE_LIMIT + 1),
    supabase.from('acquisition_rejection_reasons_v1').select('*')
      .eq('workspace_id', workspaceId)
      .gte('last_rejected_at', since)
      .order('last_rejected_at', { ascending: false }).limit(PAGE_LIMIT + 1),
  ])
  if (runsResponse.error) throw runsResponse.error
  if (reasonsResponse.error) throw reasonsResponse.error
  const runs = runsResponse.data || []
  const reasons = reasonsResponse.data || []
  return {
    runs: runs.slice(0, PAGE_LIMIT),
    reasons: reasons.slice(0, PAGE_LIMIT),
    truncated: runs.length > PAGE_LIMIT || reasons.length > PAGE_LIMIT,
  }
}

export function aggregateRejectionReasons(rows = []) {
  const reasons = new Map()
  for (const row of rows) {
    const key = String(row.rejection_reason || 'unspecified')
    reasons.set(key, (reasons.get(key) || 0) + (Number(row.rejected_events) || 0))
  }
  return [...reasons.entries()].map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
}
