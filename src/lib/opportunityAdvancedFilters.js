// Classification uses stored evidence only. Unknown is distinct from a negative match.
// Do not use title/description guesses for remote or budget status.
const normalize = value => String(value ?? '').trim().toLowerCase()

export const BUDGET_EVIDENCE = ['all', 'listed', 'estimated', 'unknown']
export const PROJECT_KINDS = ['all', 'fixed', 'hourly', 'ongoing', 'other', 'unknown']
export const WORK_MODES = ['all', 'remote', 'onsite', 'hybrid', 'unknown']

export function getBudgetEvidence(opportunity = {}) {
  if (normalize(opportunity?.budget_text)) return 'listed'
  const positive = value => value !== null && value !== undefined && value !== '' &&
    Number.isFinite(Number(value)) && Number(value) > 0
  if (positive(opportunity?.estimated_value_min) || positive(opportunity?.estimated_value_max)) return 'estimated'
  return 'unknown'
}

export function getProjectKind(opportunity = {}) {
  const value = normalize(opportunity?.project_type)
  if (!value) return 'unknown'
  if (/\b(hourly|per.hour|hours?)\b/.test(value)) return 'hourly'
  if (/\b(fixed|one.time|milestone)\b/.test(value)) return 'fixed'
  if (/\b(ongoing|retainer|monthly|long.term|recurring)\b/.test(value)) return 'ongoing'
  return 'other'
}

export function getWorkMode(opportunity = {}) {
  const value = normalize(opportunity?.remote_status)
  if (!value || value.includes('unspecified') || value.includes('unknown') ||
    value.includes('not stated') || value.includes('not specified')) return 'unknown'
  if (/\b(hybrid)\b/.test(value)) return 'hybrid'
  if (/\b(on.site|onsite|in.office|office.based)\b/.test(value)) return 'onsite'
  if (/\b(remote|work.from.home|wfh)\b/.test(value)) return 'remote'
  return 'unknown'
}

export function normalizeAdvancedFilters(filters = {}) {
  const allowed = (value, values) => values.includes(value) ? value : 'all'
  return {
    budget_evidence: allowed(filters.budget_evidence, BUDGET_EVIDENCE),
    project_kind: allowed(filters.project_kind, PROJECT_KINDS),
    work_mode: allowed(filters.work_mode, WORK_MODES),
  }
}

export function matchesAdvancedFilters(opportunity, filters = {}) {
  const selected = normalizeAdvancedFilters(filters)
  return (selected.budget_evidence === 'all' || getBudgetEvidence(opportunity) === selected.budget_evidence) &&
    (selected.project_kind === 'all' || getProjectKind(opportunity) === selected.project_kind) &&
    (selected.work_mode === 'all' || getWorkMode(opportunity) === selected.work_mode)
}
