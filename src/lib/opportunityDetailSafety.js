/**
 * Never compare optional error IDs until the error object itself exists.
 * PR #59 had undefined === undefined followed by null.message during render.
 */
export function getOpportunityPitchError(error, opportunityId) {
  if (!error || !opportunityId || error.id !== opportunityId) return ''
  return typeof error.message === 'string' ? error.message : ''
}

export function getOpportunityPitchState(opportunity = {}) {
  const hasDraft = typeof opportunity?.outreach_message === 'string' && opportunity.outreach_message.trim().length > 0
  const state = String(opportunity?.outreach_status || 'not_generated')
  const canGenerate = !hasDraft && ['not_generated', ''].includes(state)
  return { hasDraft, canGenerate }
}
