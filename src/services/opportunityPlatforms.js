/**
 * View-only filters for already saved opportunities.
 * Do not mix up the lead's source with enabled acquisition providers.
 */
const PLATFORM_LABELS = Object.freeze({
  google: 'Google Search',
  freelancer: 'Freelancer',
  upwork: 'Upwork',
  reddit: 'Reddit',
  peopleperhour: 'PeoplePerHour',
  other: 'Unknown source',
})

const SOURCE_ALIASES = Object.freeze({
  google_search: 'google',
  google_web: 'google',
  serpapi_google: 'google',
  'freelancer.com': 'freelancer',
  freelancer_api: 'freelancer',
  'upwork.com': 'upwork',
  'reddit.com': 'reddit',
  'peopleperhour.com': 'peopleperhour',
})

export const OPPORTUNITY_SORT_OPTIONS = Object.freeze([
  { value: 'score', label: 'Highest score (final first)' },
  { value: 'newest', label: 'Newest saved first' },
  { value: 'platform', label: 'Platform A–Z' },
])

export function getOpportunityPlatform(source) {
  const raw = typeof source === 'string' ? source.trim().toLowerCase() : ''
  if (!raw) return 'other'
  return SOURCE_ALIASES[raw] || raw
}

export function getOpportunityPlatformLabel(source) {
  const key = getOpportunityPlatform(source)
  if (PLATFORM_LABELS[key]) return PLATFORM_LABELS[key]
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase()).slice(0, 60)
}

export function getOpportunityPlatformOptions(opportunities = [], selected = []) {
  const counts = new Map()
  for (const opportunity of Array.isArray(opportunities) ? opportunities : []) {
    const key = getOpportunityPlatform(opportunity?.source)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  // Keep selected platforms visible even when refreshed data contains no results.
  for (const key of selected) {
    const canonical = getOpportunityPlatform(key)
    if (!counts.has(canonical)) counts.set(canonical, 0)
  }
  const preferredOrder = ['freelancer', 'google', 'upwork', 'reddit', 'peopleperhour']
  return [...counts.entries()].map(([value, count]) => ({
    value, count, label: getOpportunityPlatformLabel(value),
  })).sort((a, b) => {
    const aRank = preferredOrder.indexOf(a.value)
    const bRank = preferredOrder.indexOf(b.value)
    if (aRank !== bRank) {
      if (aRank === -1) return 1
      if (bRank === -1) return -1
      return aRank - bRank
    }
    return a.label.localeCompare(b.label)
  })
}

export function toggleOpportunityPlatform(selected, platform) {
  const key = getOpportunityPlatform(platform)
  const current = Array.isArray(selected)
    ? [...new Set(selected.map(getOpportunityPlatform))] : []
  return current.includes(key)
    ? current.filter(value => value !== key)
    : [...current, key]
}

export function matchesOpportunityPlatforms(opportunity, selected) {
  if (!Array.isArray(selected) || selected.length === 0) return true
  return selected.includes(getOpportunityPlatform(opportunity?.source))
}

const timestamp = value => {
  const ms = Date.parse(value || '')
  return Number.isFinite(ms) ? ms : -Infinity
}

function scoreParts(opportunity) {
  const stage = String(opportunity?.score_stage || '').trim().toLowerCase()
  const value = stage === 'final' ? opportunity?.total_score
    : stage === 'preliminary' ? opportunity?.preliminary_score : null
  if (value === '' || value === undefined || value === null) return [0, -Infinity]
  const score = Number(value)
  if (!Number.isFinite(score) || score < 0 || score > 100) return [0, -Infinity]
  return [stage === 'final' ? 2 : 1, score]
}

/** Sort a copy; keep original opportunities and backend ordering unchanged. */
export function sortOpportunities(opportunities, sortBy = 'score') {
  const items = Array.isArray(opportunities) ? [...opportunities] : []
  const latest = (a, b) => timestamp(b?.created_at) - timestamp(a?.created_at)
  if (sortBy === 'newest') return items.sort(latest)
  if (sortBy === 'platform') {
    return items.sort((a, b) =>
      getOpportunityPlatformLabel(a?.source).localeCompare(getOpportunityPlatformLabel(b?.source)) ||
      latest(a, b)
    )
  }
  return items.sort((a, b) => {
    const [stageA, scoreA] = scoreParts(a)
    const [stageB, scoreB] = scoreParts(b)
    return stageB - stageA || scoreB - scoreA || latest(a, b)
  })
}
