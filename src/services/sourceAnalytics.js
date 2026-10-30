import { supabase } from '../lib/supabase'

const EVENT_FIELDS = `
  id,
  workspace_id,
  master_execution_id,
  source,
  source_environment,
  source_item_id,
  candidate_key,
  event_type,
  search_query,
  gate_reason,
  source_result_type,
  source_quality_score,
  buyer_likelihood,
  intent_level,
  preliminary_score,
  created_at
`

export function summarizeSourceEvents(events = []) {
  const bySource = {}

  for (const event of Array.isArray(events) ? events : []) {
    const source = String(event?.source || 'unknown').trim().toLowerCase()

    if (!bySource[source]) {
      bySource[source] = {
        source,
        evaluated: 0,
        rejected: 0,
        qualified: 0,
        duplicates: 0,
        created: 0,
        qualifiedScoreTotal: 0,
        qualifiedScoreCount: 0,
        latestEventAt: null,
      }
    }

    const summary = bySource[source]
    const eventType = String(event?.event_type || '').trim().toLowerCase()

    if (eventType === 'evaluated') summary.evaluated += 1
    if (eventType === 'rejected') summary.rejected += 1
    if (eventType === 'qualified') {
      summary.qualified += 1

      const score = Number(event?.preliminary_score)

      if (Number.isFinite(score)) {
        summary.qualifiedScoreTotal += score
        summary.qualifiedScoreCount += 1
      }
    }
    if (eventType === 'duplicate') summary.duplicates += 1
    if (eventType === 'created') summary.created += 1

    if (
      event?.created_at &&
      (!summary.latestEventAt ||
        new Date(event.created_at) > new Date(summary.latestEventAt))
    ) {
      summary.latestEventAt = event.created_at
    }
  }

  return Object.fromEntries(
    Object.entries(bySource).map(([source, summary]) => {
      const qualificationRate =
        summary.evaluated > 0
          ? (summary.qualified / summary.evaluated) * 100
          : 0

      const duplicateRate =
        summary.qualified > 0
          ? (summary.duplicates / summary.qualified) * 100
          : 0

      const averagePreliminaryScore =
        summary.qualifiedScoreCount > 0
          ? summary.qualifiedScoreTotal / summary.qualifiedScoreCount
          : null

      return [
        source,
        {
          source,
          evaluated: summary.evaluated,
          rejected: summary.rejected,
          qualified: summary.qualified,
          duplicates: summary.duplicates,
          created: summary.created,
          qualificationRate,
          duplicateRate,
          averagePreliminaryScore,
          latestEventAt: summary.latestEventAt,
        },
      ]
    })
  )
}


export function getAdaptiveSourceStrategy(metrics = {}) {
  const evaluated = Number(metrics?.evaluated || 0)
  const qualificationRate = Number(metrics?.qualificationRate || 0)
  const duplicateRate = Number(metrics?.duplicateRate || 0)

  const minSample = 10
  const boostSample = 25

  let trafficMultiplier = 1
  let resultLimitMultiplier = 1
  let strategyReason = 'insufficient_sample_full_traffic'

  if (evaluated >= minSample) {
    if (qualificationRate >= 30) {
      trafficMultiplier = 1
      strategyReason = 'healthy_source_full_traffic'
    } else if (qualificationRate >= 10) {
      trafficMultiplier = 0.5
      strategyReason = 'weak_source_half_traffic'
    } else {
      trafficMultiplier = 0.25
      strategyReason = 'very_weak_source_floor_traffic'
    }
  }

  if (
    evaluated >= boostSample &&
    qualificationRate >= 50 &&
    duplicateRate < 50
  ) {
    resultLimitMultiplier = 1.5
    strategyReason = 'strong_source_boost'
  }

  const label =
    strategyReason === 'strong_source_boost'
      ? 'Strong source · 1.5× result cap'
      : strategyReason === 'very_weak_source_floor_traffic'
        ? 'Weak source · 25% floor traffic'
        : strategyReason === 'weak_source_half_traffic'
          ? 'Weak source · 50% traffic'
          : strategyReason === 'healthy_source_full_traffic'
            ? 'Healthy source · full traffic'
            : 'Learning · full traffic'

  return {
    enabled: true,
    minSample,
    boostSample,
    trafficMultiplier,
    resultLimitMultiplier,
    strategyReason,
    label,
  }
}

export async function fetchSourceAnalytics(
  workspaceId,
  { days = 30, limit = 5000 } = {}
) {
  if (!workspaceId) return {}

  const safeDays = Math.max(1, Math.min(90, Number(days) || 30))
  const safeLimit = Math.max(100, Math.min(10000, Number(limit) || 5000))
  const since = new Date(
    Date.now() - safeDays * 24 * 60 * 60 * 1000
  ).toISOString()

  const { data, error } = await supabase
    .from('source_candidate_events')
    .select(EVENT_FIELDS)
    .eq('workspace_id', workspaceId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error) throw error

  return summarizeSourceEvents(data || [])
}
