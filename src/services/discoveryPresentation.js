const REJECTION_REASONS = Object.freeze({
  ai_not_opportunity: 'Not a buyer request',
  intent_below_threshold: 'Buyer intent below threshold',
  low_intent: 'Buyer intent below threshold',
  service_match_unsupported: 'Service match lacks evidence',
  service_mismatch: 'Service does not match',
  eligibility_mismatch: 'Eligibility requirements not met',
  eligibility_restricted: 'Eligibility requirements not met',
  weak_source: 'Source quality below threshold',
  stale_source: 'Listing too old',
  stale_listing: 'Listing too old',
  budget_below_minimum: 'Below minimum project budget',
  below_minimum_budget: 'Below minimum project budget',
  unclassified: 'Other or unclassified reasons',
})

function count(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0
}

function uniqueQueries(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  return value.filter(item => typeof item === 'string').map(item => item.trim())
    .filter(item => {
      const normalized = item.toLowerCase()
      if (!item || seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
}

export function getDiscoveryQuerySummary({
  customQueries = [], aiQueries = [], aiEnabled = true,
  queryBatchSize = 10, enabledSources = [],
} = {}) {
  const custom = uniqueQueries(customQueries)
  const generated = uniqueQueries(aiQueries)
  const selected = uniqueQueries([...custom, ...(aiEnabled ? generated : [])])
  const batch = count(queryBatchSize)
  return {
    customCount: custom.length,
    aiCount: generated.length,
    aiIncluded: Boolean(aiEnabled),
    configuredCount: selected.length,
    batchLimit: batch,
    selectedSources: Array.isArray(enabledSources)
      ? [...new Set(enabledSources.filter(item => typeof item === 'string' && item.trim()))]
      : [],
    // Batch size is a preference, not a guarantee about executed provider requests.
    estimate: selected.length && batch
      ? `Up to ${Math.min(batch, selected.length)} configured phrases may be selected per run. Source routing and provider limits may reduce requests.`
      : 'Configure at least one search phrase to run discovery.',
  }
}

export function getDiscoveryRunState(run, running = false) {
  const status = String(run?.run_status || run?.status || '').trim().toLowerCase()
  if (running) return {
    kind: 'running', title: 'Discovery in progress',
    detail: 'The engine may be collecting, qualifying, researching or scoring. Individual step timings are not available here.',
  }
  if (['completed', 'success', 'succeeded'].includes(status)) return {
    kind: 'success', title: 'Last run completed',
    detail: 'The workflow finished. Check the candidate breakdown for what was saved or rejected.',
  }
  if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) return {
    kind: 'error', title: 'Last run needs attention',
    detail: 'The workflow did not complete normally. Review the error before starting another run.',
  }
  if (['queued', 'pending', 'running'].includes(status)) return {
    kind: 'pending', title: 'Last recorded run is pending',
    detail: 'Refresh later to check the recorded execution status.',
  }
  return {
    kind: 'neutral', title: 'Ready to discover',
    detail: 'Run the engine to search for buyer requests based on your saved workspace settings.',
  }
}

function readableReason(key) {
  const normalized = String(key || 'unclassified').toLowerCase().trim()
  if (REJECTION_REASONS[normalized]) return REJECTION_REASONS[normalized]
  const cleaned = normalized.replace(/[^a-z0-9 _-]/g, '').replace(/[_-]+/g, ' ').trim()
  if (!cleaned) return REJECTION_REASONS.unclassified
  return cleaned.split(/\s+/).slice(0, 9).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}

export function getDiscoveryBreakdown(diagnostics) {
  if (!diagnostics) return null
  const counts = diagnostics.counts || {}
  const eventCounts = {
    evaluated: count(counts.evaluated),
    rejected: count(counts.rejected),
    qualified: count(counts.qualified),
    duplicate: count(counts.duplicate),
    created: count(counts.created),
  }
  const rawReasons = diagnostics.reasons && typeof diagnostics.reasons === 'object'
    ? diagnostics.reasons : {}
  const reasons = Object.entries(rawReasons)
    .map(([key, value]) => ({ key, label: readableReason(key), count: count(value) }))
    .filter(item => item.count > 0)
    .sort((a,b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 5)
  const rawSources = diagnostics.sourceCounts && typeof diagnostics.sourceCounts === 'object'
    ? diagnostics.sourceCounts : {}
  const sources = Object.entries(rawSources).map(([source, values]) => ({
    source: String(source || 'other').slice(0, 45),
    evaluated: count(values?.evaluated),
    qualified: count(values?.qualified),
    created: count(values?.created),
    duplicate: count(values?.duplicate),
    rejected: count(values?.rejected),
  })).sort((a,b) => b.evaluated - a.evaluated).slice(0, 12)
  return {
    counts: eventCounts,
    sources,
    reasons,
    truncated: diagnostics.truncated === true,
    // Each phase emits events; counts are not a unique-candidate funnel.
    note: 'Counts reflect events logged at different stages; do not add the columns together as unique opportunities.',
  }
}
