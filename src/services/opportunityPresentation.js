import { getServiceMatchDetails } from './serviceMatch.js'

const ACTION_LABELS = Object.freeze({
  high_priority_pitch: 'Priority pitch candidate',
  pitch: 'Pitch candidate',
  research: 'Needs more research',
  review: 'Manual review',
  skip: 'Not recommended',
})

function positiveAmount(value) {
  if (value === null || value === undefined || value === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function currencyText(value, currency) {
  const code = String(currency || 'USD').trim().toUpperCase()
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency', currency: code, maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${value.toLocaleString('en')} ${/^[A-Z]{3}$/.test(code) ? code : 'USD'}`
  }
}

/** Never present an AI estimate as a client-posted project budget. */
export function getOpportunityBudget(opportunity = {}) {
  const listed = String(opportunity?.budget_text || '').trim()
  if (listed) return {
    label: 'Listed budget / rate', value: listed.slice(0, 170), kind: 'listed',
    detail: 'From the source listing; confirm with the buyer.',
  }

  const min = positiveAmount(opportunity?.estimated_value_min)
  const max = positiveAmount(opportunity?.estimated_value_max)
  const currency = opportunity?.estimated_currency
  if (!min && !max) return {
    label: 'Budget', value: 'Not specified', kind: 'unknown',
    detail: 'No budget is available in the saved opportunity.',
  }

  const value = min && max
    ? (min === max ? currencyText(min, currency) : `${currencyText(min, currency)} – ${currencyText(max, currency)}`)
    : min ? `From ${currencyText(min, currency)}` : `Up to ${currencyText(max, currency)}`

  return {
    label: 'Estimated project value', value, kind: 'estimated',
    detail: 'Model estimate; not a confirmed buyer budget.',
  }
}

export function getOpportunityScore(opportunity = {}) {
  const stage = String(opportunity?.score_stage || '').toLowerCase()
  const field = stage === 'final' ? opportunity?.total_score
    : stage === 'preliminary' ? opportunity?.preliminary_score : null

  if (field === null || field === undefined || field === '') return {
    label: 'Not scored', value: null, stage: 'unknown', detail: 'No reliable score is available.',
  }
  const numeric = Number(field)
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) return {
    label: 'Not scored', value: null, stage: 'unknown', detail: 'No reliable score is available.',
  }
  return {
    label: stage === 'final' ? 'Final score' : 'Initial score',
    value: Math.round(numeric), stage,
    detail: stage === 'final'
      ? 'Opportunity prioritization score; not a probability of winning.'
      : 'Preliminary qualification score; final research and ranking are pending.',
  }
}

export function getOpportunityResearch(opportunity = {}) {
  switch (String(opportunity?.research_status || '').toLowerCase()) {
    case 'completed':
      return {
        label: 'Research completed', tone: 'complete',
        detail: 'Research workflow finished; this does not verify the buyer or guarantee the listing is genuine.',
      }
    case 'partial':
      return {
        label: 'Partial research', tone: 'partial',
        detail: 'Source-based research only. Company identity and contact details may be unverified.',
      }
    case 'pending':
      return {
        label: 'Research pending', tone: 'pending',
        detail: 'Additional research has not yet completed.',
      }
    default:
      return {
        label: 'Research status unknown', tone: 'unknown',
        detail: 'No research completion status is available.',
      }
  }
}

export function getOpportunityAction(opportunity = {}, serviceMatch = getServiceMatchDetails(opportunity)) {
  const key = String(opportunity?.recommended_action || '').toLowerCase()
  if (serviceMatch?.level === 'unsupported') return {
    label: 'Not recommended',
    caution: true,
    detail: 'The saved service evidence does not support this offer. Review the buyer requirement before any outreach.',
  }
  if (serviceMatch?.level === 'related' &&
      ['pitch', 'high_priority_pitch'].includes(key)) return {
    label: 'Manual review — related fit',
    caution: true,
    detail: 'The buyer did not confirm an exact service match. Review the listing before choosing to pitch.',
  }
  return {
    label: ACTION_LABELS[key] || 'Review next action',
    caution: ['skip', 'review', 'research'].includes(key) || !ACTION_LABELS[key],
    detail: key === 'skip'
      ? 'The engine does not recommend outreach. You can still inspect this listing.'
      : key === 'research'
        ? 'Check buyer needs and source details before deciding to pitch.'
        : key === 'review'
          ? 'A human review is needed before moving forward.'
          : key === 'pitch' || key === 'high_priority_pitch'
            ? 'Suggested for drafting, not authorized or automatically sent.'
            : 'No verified outreach recommendation is available.',
  }
}

export function getSafeSourceUrl(opportunity = {}) {
  const input = String(opportunity?.source_url || '').trim()
  if (!/^https?:\/\//i.test(input)) return null
  try {
    const parsed = new URL(input)
    if (!parsed.hostname || !['http:', 'https:'].includes(parsed.protocol)) return null
    return parsed.href
  } catch {
    return null
  }
}

export function getRequirementPreview(opportunity = {}, limit = 210) {
  const text = String(opportunity?.requirement || '').replace(/\s+/g, ' ').trim()
  if (!text) return 'No buyer requirement available yet. Review the source listing.'
  if (text.length <= limit) return text
  const head = text.slice(0, Math.max(1, limit - 1))
  const wordEnd = head.lastIndexOf(' ')
  return `${head.slice(0, wordEnd >= limit / 2 ? wordEnd : head.length).trimEnd()}…`
}

export function getOpportunityPresentation(opportunity = {}) {
  const serviceMatch = getServiceMatchDetails(opportunity)
  return {
    score: getOpportunityScore(opportunity),
    budget: getOpportunityBudget(opportunity),
    research: getOpportunityResearch(opportunity),
    serviceMatch,
    action: getOpportunityAction(opportunity, serviceMatch),
    sourceUrl: getSafeSourceUrl(opportunity),
    requirement: getRequirementPreview(opportunity),
  }
}
