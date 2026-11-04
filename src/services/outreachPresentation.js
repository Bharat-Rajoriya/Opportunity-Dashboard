import { getServiceMatchDetails } from './serviceMatch.js'
import { requiresOutreachReview } from './outreachSafety.js'
import { getOpportunityBudget, getSafeSourceUrl } from './opportunityPresentation.js'

export function getOutreachLeadContext(lead = {}) {
  const match = getServiceMatchDetails(lead)
  const budget = getOpportunityBudget(lead)
  const rawScore = lead.total_score
  const score = rawScore === null || rawScore === undefined || rawScore === ''
    ? null : Number(rawScore)
  const safeScore = Number.isFinite(score) && score >= 0 && score <= 100
    ? Math.round(score) : null
  const research = String(lead.research_status || '').toLowerCase()
  const researchLabel = research === 'completed' ? 'Research completed'
    : research === 'partial' ? 'Partial research'
      : research === 'pending' ? 'Research pending' : 'Research not assessed'
  return {
    match,
    budget,
    score: safeScore,
    sourceUrl: getSafeSourceUrl(lead),
    researchLabel,
    researchNeedsReview: research !== 'completed',
    needsReview: requiresOutreachReview(lead),
    channel: String(lead.outreach_channel || '').trim() || 'Channel not set',
  }
}

export function getDraftWordCount(value) {
  const clean = String(value || '').trim()
  return clean ? clean.split(/\s+/).length : 0
}

export function getOutreachSummary(pending = 0, ready = 0) {
  const safePending = Math.max(0, Math.floor(Number(pending) || 0))
  const safeReady = Math.max(0, Math.floor(Number(ready) || 0))
  return {
    pending: safePending,
    ready: safeReady,
    total: safePending + safeReady,
  }
}

export function getSendInstruction(lead) {
  const source = getSafeSourceUrl(lead)
  return source
    ? 'Copy the approved message, open the original listing, and send it there yourself. Then record your action.'
    : 'Copy the approved message and send it through your verified external channel. No valid listing link is saved.'
}
