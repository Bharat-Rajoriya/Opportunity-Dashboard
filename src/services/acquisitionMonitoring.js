import { supabase } from '../lib/supabase'

// A completed run can have zero candidates without being an API failure.
// Evidence labels are intentionally conservative: provider errors are only
// identified when the existing execution log actually records them.
const MAX_RUNS = 300
const STALE_AFTER_MS = 30 * 60 * 1000

export function classifyEngineFailure(message = '') {
  const text = String(message || '').toLowerCase()
  if (/\b(quota|credits? exhausted|plan limit|monthly limit|usage limit)\b/.test(text))
    return { kind: 'quota', label: 'Provider quota / credit limit recorded' }
  if (/\b429\b|too many requests|rate.?limit|throttl/.test(text))
    return { kind: 'rate_limit', label: 'Rate limiting recorded' }
  if (/\b(401|403)\b|unauthori[sz]ed|forbidden|invalid api key|authentication/.test(text))
    return { kind: 'authorization', label: 'Provider or workflow authorization error' }
  if (/\b(timeout|timed out|etimedout|econnreset|connection refused|network error)\b/.test(text))
    return { kind: 'network', label: 'Connection / timeout error' }
  if (/\b(500|502|503|504)\b|service unavailable|internal server/.test(text))
    return { kind: 'upstream', label: 'Upstream service error' }
  return { kind: 'execution', label: 'Workflow execution failure' }
}

export function summarizeRunSignals(run, funnelRows = [], now = Date.now()) {
  const matched = funnelRows.filter(row => String(row.master_execution_id) === String(run.master_execution_id))
  const totals = matched.reduce((acc, row) => {
    for (const [key, field] of [
      ['evaluated', 'evaluated_events'],
      ['rejected', 'rejected_events'],
      ['qualified', 'qualified_events'],
      ['created', 'created_events'],
      ['duplicates', 'duplicate_events'],
    ]) acc[key] += Number(row[field]) || 0
    return acc
  }, { evaluated: 0, rejected: 0, qualified: 0, created: 0, duplicates: 0 })

  const status = String(run.run_status || '').toLowerCase()
  const health = String(run.health_status || '').toLowerCase()
  const started = new Date(run.run_started_at).getTime()
  const stale = status === 'running' && !run.run_finished_at &&
    Number.isFinite(started) && now - started > STALE_AFTER_MS
  const failed = status === 'failed'
  const completed = status === 'completed'
  const category = failed ? classifyEngineFailure(run.error_message) : null

  let severity = 'ok'
  let label = 'Completed'
  if (failed) {
    severity = 'error'
    label = category.label
  } else if (stale) {
    severity = 'warning'
    label = 'Run may be stalled (over 30 minutes)'
  } else if (status === 'running') {
    severity = 'info'
    label = 'Run in progress'
  } else if (!completed) {
    severity = 'warning'
    label = 'Unknown run status'
  } else if (health === 'critical') {
    severity = 'error'
    label = 'Completed with critical workflow health warning'
  } else if (totals.evaluated === 0) {
    severity = 'warning'
    label = 'Completed; no candidate evaluation events'
  } else if (totals.created > 0) {
    label = 'New opportunities recorded'
  } else if (totals.qualified > 0 && totals.duplicates >= totals.qualified) {
    label = 'Qualified candidates already saved'
  } else if (totals.qualified === 0 && totals.rejected > 0) {
    label = 'All recorded evaluated candidates rejected'
  } else {
    severity = 'warning'
    label = 'Completed; no new opportunities saved'
  }

  const warnings = Array.isArray(run.health_warnings)
    ? run.health_warnings.filter(item => item && typeof item.message === 'string').slice(0, 3)
    : []

  return {
    id: run.id,
    executionId: String(run.master_execution_id || ''),
    startedAt: run.run_started_at,
    finishedAt: run.run_finished_at,
    status,
    health,
    severity,
    label,
    category: category?.kind || null,
    failedStep: failed ? String(run.failed_step || '') : '',
    // Do not surface raw provider errors: they might contain request URLs or secrets.
    warningLabels: warnings.map(item => item.severity === 'critical'
      ? 'Critical workflow health check reported'
      : 'Workflow health warning reported'),
    totals,
  }
}

export function summarizeAcquisitionMonitoring(rows = []) {
  return rows.reduce((summary, row) => {
    summary.total += 1
    if (row.status === 'failed') summary.failed += 1
    if (row.category === 'rate_limit') summary.rateLimited += 1
    if (row.category === 'quota') summary.quotaFailures += 1
    if (row.status === 'completed' && row.totals.evaluated === 0) summary.noEvaluations += 1
    if (row.status === 'completed' && row.health === 'critical') summary.criticalHealth += 1
    if (row.status === 'running') summary.running += 1
    return summary
  }, { total: 0, failed: 0, rateLimited: 0, quotaFailures: 0, noEvaluations: 0, criticalHealth: 0, running: 0 })
}

export async function fetchEngineRunMonitoring(workspaceId, { days = 30 } = {}) {
  if (!workspaceId) return { runs: [], truncated: false }
  const safeDays = Math.max(1, Math.min(90, Number(days) || 30))
  const since = new Date(Date.now() - safeDays * 86400000).toISOString()
  const { data, error } = await supabase
    .from('engine_runs')
    .select('id,workspace_id,master_execution_id,run_started_at,run_finished_at,run_status,health_status,health_warnings,failed_step,error_message')
    .eq('workspace_id', workspaceId)
    .gte('run_started_at', since)
    .order('run_started_at', { ascending: false })
    .limit(MAX_RUNS + 1)
  if (error) throw error
  const rows = data || []
  return { runs: rows.slice(0, MAX_RUNS), truncated: rows.length > MAX_RUNS }
}
