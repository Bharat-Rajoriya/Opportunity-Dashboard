import { stratifiedSample, auditIndicators, scoreBand, sourceName } from './lead-quality-benchmark.mjs'

// A review queue, NOT a classifier. Every finding requires human inspection.
const clean = value => typeof value === 'string' ? value.trim() : ''
const safeScore = row => row.total_score === null || row.total_score === undefined || row.total_score === ''
  ? null : Number.isFinite(Number(row.total_score)) ? Number(row.total_score) : null

export function sourceUrlStatus(raw) {
  const value = clean(raw)
  if (!value) return 'missing'
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname) return 'invalid'
    if (url.username || url.password) return 'contains_credentials'
    return url.protocol === 'https:' ? 'https' : 'http'
  } catch { return value.startsWith('/') ? 'relative' : 'invalid' }
}

const PROMOTION_PATTERNS = [
  /\bwe (?:build|design|develop|offer|provide|specialize in)\b/i,
  /\b(?:our|my) (?:agency|services|portfolio)\b/i,
  /\b(?:white[ -]?label partnership|looking for partners|available for hire)\b/i,
]

export function potentialPromotion(row) {
  const title = clean(row.title)
  // A weak review signal from title only; never label invalid automatically.
  return PROMOTION_PATTERNS.some(pattern => pattern.test(title))
}

export function reviewFlags(row) {
  const base = auditIndicators(row)
  const status = sourceUrlStatus(row.source_url)
  const flags = []
  if (status !== 'https') flags.push('source_url_' + status)
  if (base.publication_date_missing) flags.push('publication_date_missing')
  if (base.research_incomplete) flags.push('research_incomplete')
  if (base.source_type_unknown) flags.push('source_type_unknown')
  if (base.service_unmatched) flags.push('service_unmatched')
  if (!clean(row.source_quality_reason)) flags.push('source_quality_reason_missing')
  if (base.budget_not_recorded) flags.push('budget_not_recorded')
  if (potentialPromotion(row)) flags.push('title_may_be_provider_promotion')
  if (safeScore(row) !== null && safeScore(row) >= 75 && base.research_incomplete)
    flags.push('high_score_without_complete_research')
  return flags
}

const severity = flags => flags.some(x => x.startsWith('source_url_')) ? 0
  : flags.includes('title_may_be_provider_promotion') ? 1
  : flags.includes('high_score_without_complete_research') ? 2 : 3

export function prepareValidationQueue(rows, perStratum = 6) {
  const selected = stratifiedSample(rows, perStratum)
  const byId = new Map(rows.map(row => [row.id, row]))
  return selected.map(item => {
    const row = byId.get(item.id)
    const flags = reviewFlags(row)
    return { ...item, evidence_flags: flags, priority: severity(flags) + 1,
      reviewer_checked_at: null,
      reviewer_source_access: 'not_checked',
      reviewer_evidence_url: '',
      review_evidence: '',
      review_label: 'uncertain' }
  }).sort((a,b) => a.priority - b.priority ||
    a.source.localeCompare(b.source) || a.id.localeCompare(b.id))
}

export function summarizeValidationFindings(rows) {
  if (!Array.isArray(rows)) throw new Error('Expected opportunity rows array')
  const bySource = {}
  const flags = {}
  const examples = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const source = sourceName(row)
    const current = bySource[source] ||= { total:0, high_score:0, with_review_flags:0 }
    current.total++
    if ((safeScore(row) ?? -Infinity) >= 75) current.high_score++
    const rowFlags = reviewFlags(row)
    if (rowFlags.length) current.with_review_flags++
    for (const flag of rowFlags) flags[flag] = (flags[flag] || 0) + 1
    if (rowFlags.some(f => f.startsWith('source_url_'))) {
      examples.push({ source, title:clean(row.title).slice(0,180),
        score_band:scoreBand(row), issue:'source URL needs manual inspection' })
    }
  }
  return {
    total:rows.length, by_source:bySource, flags,
    malformed_url_examples:examples.slice(0,10),
    limitations:'Flags indicate missing or suspicious evidence, never verified false positives. Review original pages before labeling any lead.'
  }
}
