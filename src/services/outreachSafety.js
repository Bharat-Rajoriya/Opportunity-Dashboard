import { getServiceMatchDetails } from './serviceMatch.js'

/** These are workflow warnings, not an authorization decision. */
export function requiresOutreachReview(opportunity) {
  const action = String(opportunity?.recommended_action || '').toLowerCase()
  const score = Number(opportunity?.total_score)
  const match = getServiceMatchDetails(opportunity)

  return action === 'skip' ||
    (Number.isFinite(score) && score < 55) ||
    match?.level === 'related' ||
    match?.level === 'unsupported'
}

export function manualPitchWarning(opportunity) {
  if (!requiresOutreachReview(opportunity)) return null

  const title = String(opportunity?.title || 'This opportunity').slice(0, 90)
  const action = String(opportunity?.recommended_action || 'review').replaceAll('_', ' ')
  const score = Number(opportunity?.total_score)
  const scoreLine = Number.isFinite(score) ? `Score: ${score}/100. ` : ''
  return `${title}\n\n${scoreLine}Recommended action: ${action}.\n\nThis match requires manual review. Generating a draft does not send anything and does not mean the lead is verified. Continue?`
}

export function approvalWarning(opportunity) {
  if (!requiresOutreachReview(opportunity)) return null
  const score = Number(opportunity?.total_score)
  const scoreLine = Number.isFinite(score) ? ` (score ${score}/100)` : ''
  return `This opportunity is low-confidence or not recommended for pitching${scoreLine}.\n\nApproving its draft is a manual override, not a verified buyer match. Approve anyway?`
}

export function markedAsSentPrompt(opportunity) {
  const warning = requiresOutreachReview(opportunity)
    ? 'WARNING: This lead was not recommended for automatic outreach.\n\n'
    : ''
  return `${warning}Have you already sent this message yourself on the external platform or by another channel?\n\nThis button does NOT send a message or verify delivery. It only records that you reported sending it.\n\nMark as sent?`
}
