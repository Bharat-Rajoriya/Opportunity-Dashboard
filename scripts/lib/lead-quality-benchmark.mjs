import { createHash } from 'node:crypto'

export const REVIEW_LABELS = new Set(['valid', 'invalid', 'uncertain'])
export const QUALITY_DIMENSIONS = ['buyer_intent', 'service_fit', 'source_authenticity', 'freshness', 'eligibility', 'commercial_fit']
const ANSWERS = new Set(['yes', 'no', 'unknown'])
const clean = x => typeof x === 'string' ? x.trim() : ''
const score = row => Number.isFinite(Number(row.total_score)) ? Number(row.total_score) : null

export function scoreBand(row) {
  const n = score(row)
  return n === null ? 'unknown' : n >= 75 ? 'high' : n >= 50 ? 'medium' : 'low'
}

export function sourceName(row) {
  return clean(row?.source).toLowerCase() || 'unknown'
}

export function auditIndicators(row) {
  return {
    publication_date_missing: !row.published_at,
    research_incomplete: row.research_status !== 'complete',
    service_unmatched: !row.matched_service_id,
    budget_not_recorded: !clean(row.budget_text) && row.estimated_value_max == null,
    source_type_unknown: !clean(row.source_result_type) || row.source_result_type === 'unknown',
    buyer_identity_not_verified: true, // no trustworthy buyer-identity verification in current persisted schema
  }
}

const stableKey = row => createHash('sha256')
  .update(String(row.id ?? row.source_url ?? row.title ?? ''))
  .digest('hex')

export function stratifiedSample(rows, perStratum = 4) {
  if (!Array.isArray(rows)) throw new Error('Expected opportunity rows array')
  if (!Number.isSafeInteger(perStratum) || perStratum < 1 || perStratum > 100)
    throw new Error('perStratum must be an integer from 1 to 100')
  const groups = new Map()
  for (const row of rows) {
    if (!row || typeof row !== 'object' || !clean(row.id) || !clean(row.source)) continue
    const group = sourceName(row) + ':' + scoreBand(row)
    groups.set(group, [...(groups.get(group) || []), row])
  }
  const result = []
  for (const group of [...groups.keys()].sort()) {
    const selected = groups.get(group)
      .sort((a,b) => stableKey(a).localeCompare(stableKey(b)))
      .slice(0, perStratum)
    for (const row of selected) {
      result.push({
        id: row.id,
        source: sourceName(row),
        score_band: scoreBand(row),
        total_score: score(row),
        title: clean(row.title),
        source_url: clean(row.source_url),
        published_at: row.published_at ?? null,
        research_status: row.research_status ?? null,
        source_result_type: row.source_result_type ?? null,
        signals: auditIndicators(row),
        review_label: 'uncertain',
        review_evidence: '',
        ...Object.fromEntries(QUALITY_DIMENSIONS.map(k => [k, 'unknown'])),
      })
    }
  }
  return result
}

function tally(items) {
  return items.reduce((out,item) => {
    const key = item.review_label
    out[key]++
    return out
  }, {valid:0, invalid:0, uncertain:0})
}

export function summarizeReviews(reviewRows) {
  if (!Array.isArray(reviewRows)) throw new Error('Expected review rows array')
  const ids = new Set()
  for (const item of reviewRows) {
    if (!item || !clean(item.id) || !REVIEW_LABELS.has(item.review_label))
      throw new Error('Each review must have an ID and valid/invalid/uncertain label')
    if (ids.has(item.id)) throw new Error('Duplicate review ID: ' + item.id)
    ids.add(item.id)
    for (const d of QUALITY_DIMENSIONS) {
      if (!ANSWERS.has(item[d])) throw new Error('Invalid dimension: ' + d)
    }
    if (item.review_label !== 'uncertain' && clean(item.review_evidence).length < 15)
      throw new Error('Decisive labels require at least 15 characters of evidence')
    if (item.review_label === 'valid' &&
      ['buyer_intent','service_fit','source_authenticity','freshness','eligibility'].some(k => item[k] !== 'yes'))
      throw new Error('Valid leads require evidence-backed yes for buyer intent, service fit, source authenticity, freshness and eligibility')
    if (item.review_label === 'invalid' && !QUALITY_DIMENSIONS.some(k => item[k] === 'no'))
      throw new Error('Invalid leads require at least one documented no dimension')
  }
  const overall = tally(reviewRows)
  const decided = overall.valid + overall.invalid
  const result = {
    sample_size: reviewRows.length,
    reviewed_with_verdict: decided,
    unresolved: overall.uncertain,
    reviewed_coverage: reviewRows.length ? Number((decided / reviewRows.length).toFixed(3)) : null,
    valid: overall.valid,
    invalid: overall.invalid,
    precision_among_decided: decided ? Number((overall.valid/decided).toFixed(3)) : null,
    // Unresolved cases must not be silently counted as valid.
    conservative_valid_fraction: reviewRows.length
      ? Number((overall.valid/reviewRows.length).toFixed(3)) : null,
    by_source: {},
    by_score_band: {},
    dimensions_no: {},
    warning: decided < 20 ? 'Fewer than 20 decided labels: directional audit only, not a production precision claim.' : null,
  }
  for (const field of ['source','score_band']) {
    const groups = new Map()
    for (const row of reviewRows) {
      const group = clean(row[field]) || 'unknown'
      groups.set(group,[...(groups.get(group)||[]),row])
    }
    const out = field === 'source' ? result.by_source : result.by_score_band
    for (const key of [...groups.keys()].sort()) {
      const counts = tally(groups.get(key))
      const denominator = counts.valid + counts.invalid
      out[key] = { ...counts, precision_among_decided: denominator ? Number((counts.valid/denominator).toFixed(3)) : null }
    }
  }
  for (const d of QUALITY_DIMENSIONS) {
    result.dimensions_no[d] = reviewRows.filter(x => x[d] === 'no').length
  }
  return result
}

export function summarizeUnlabeled(rows) {
  if (!Array.isArray(rows)) throw new Error('Expected opportunity rows array')
  const bySource = {}
  for (const row of rows) {
    const source = sourceName(row)
    const v = bySource[source] ||= { total:0, score_75_plus:0, indicators: {} }
    v.total++
    if (score(row) !== null && score(row) >= 75) v.score_75_plus++
    for (const [key,flag] of Object.entries(auditIndicators(row))) {
      if (flag) v.indicators[key] = (v.indicators[key] || 0) + 1
    }
  }
  return { count:rows.length, by_source:bySource, note:'Indicators describe missing evidence, not proven bad leads. AI scores are not precision labels.' }
}
