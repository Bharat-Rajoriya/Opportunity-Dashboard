/**
 * Read only evidence persisted by Service Match Quality V2.
 * Legacy opportunities have no classification and should not receive a guessed label.
 */
export function getServiceMatchDetails(opportunity) {
  const raw = opportunity?.raw_payload?.service_match
  if (!raw || typeof raw !== 'object') return null

  const requestedLevel = String(raw.level || '').toLowerCase()
  if (!['exact', 'related', 'unsupported'].includes(requestedLevel)) return null

  const evidence = String(raw.evidence || '').trim().slice(0, 160)
  const reason = String(raw.reason || '').trim().slice(0, 280)
  const level = requestedLevel === 'exact' && !evidence ? 'related' : requestedLevel

  const labels = {
    exact: 'Exact service match',
    related: 'Related service — review',
    unsupported: 'Unsupported service match',
  }

  return {
    level,
    label: labels[level],
    evidence,
    reason,
    canAutoPitch: level === 'exact',
  }
}
