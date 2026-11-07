export const WORKSPACE_SECTIONS = Object.freeze([
  { id: 'overview', label: 'Overview', target: 'workspace-overview', group: 'workspace' },
  { id: 'search', label: 'Search', target: 'workspace-search', group: 'workspace' },
  { id: 'sources', label: 'Sources', target: 'workspace-sources', group: 'workspace' },
  { id: 'discovery', label: 'Discovery', target: 'workspace-discovery', group: 'workspace' },
  { id: 'opportunities', label: 'Opportunities', target: 'workspace-opportunities', group: 'workspace' },
  { id: 'outreach', label: 'Outreach', target: 'workspace-outreach', group: 'workspace' },
  { id: 'followups', label: 'Follow-ups', target: 'workspace-followups', group: 'workspace' },
  { id: 'diagnostics', label: 'Diagnostics', target: 'workspace-diagnostics', group: 'manage' },
  { id: 'settings', label: 'Settings', target: 'workspace-settings', group: 'manage' },
])

export function getWorkspaceSection(id) {
  return WORKSPACE_SECTIONS.find((section) => section.id === id) || WORKSPACE_SECTIONS[0]
}

export function getWorkspaceFocus(stats = {}, reviewCount = 0) {
  const review = Number(reviewCount) || 0
  const overdue = Number(stats.overdueFollowUps) || 0
  const today = Number(stats.dueTodayFollowUps) || 0

  if (review > 0) return {
    title: `${review} draft${review === 1 ? '' : 's'} waiting for review`,
    description: 'Check buyer fit and message quality before approving outreach.',
    action: 'Open review queue', target: 'outreach',
  }
  if (overdue + today > 0) return {
    title: `${overdue + today} follow-up${overdue + today === 1 ? '' : 's'} need attention`,
    description: 'Keep the next customer conversation moving.',
    action: 'View follow-ups', target: 'followups',
  }
  if (!(Number(stats.total) > 0)) return {
    title: 'Find your first opportunity',
    description: 'Run discovery with your configured services and sources.',
    action: 'Open discovery', target: 'discovery',
  }
  return {
    title: 'Review your opportunity pipeline',
    description: 'Explore buyer requests, scores, and next actions.',
    action: 'Browse opportunities', target: 'opportunities',
  }
}
