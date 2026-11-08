import { matchesAdvancedFilters } from './opportunityAdvancedFilters.js'
// Pure matching logic shared with read-only saved-search digest queries.
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
  if (!matchesAdvancedFilters(row, saved)) return false
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

