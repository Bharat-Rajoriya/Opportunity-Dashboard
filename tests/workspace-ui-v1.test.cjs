const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

const load = import(pathToFileURL(join(__dirname, '../src/config/workspaceUi.js')).href)

test('workspace navigation includes ten unique real sections', async () => {
  const { WORKSPACE_SECTIONS, getWorkspaceSection } = await load
  assert.deepEqual(WORKSPACE_SECTIONS.map(item => item.id), [
    'overview', 'search', 'saved-searches', 'sources', 'discovery', 'opportunities', 'outreach', 'followups', 'diagnostics', 'settings',
  ])
  assert.equal(new Set(WORKSPACE_SECTIONS.map(item => item.target)).size, 10)
  assert.equal(getWorkspaceSection('invalid').id, 'overview')
})

test('overview prioritizes drafts then follow-ups then discovery', async () => {
  const { getWorkspaceFocus } = await load
  assert.equal(getWorkspaceFocus({ total: 4, overdueFollowUps: 2 }, 1).target, 'outreach')
  assert.equal(getWorkspaceFocus({ total: 4, overdueFollowUps: 2 }, 0).target, 'followups')
  assert.equal(getWorkspaceFocus({ total: 0 }, 0).target, 'discovery')
  assert.equal(getWorkspaceFocus({ total: 4 }, 0).target, 'opportunities')
})

test('navigation anchors preserve existing search and outreach actions', () => {
  const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8')
  const shell = readFileSync(join(__dirname, '../src/components/WorkspaceShell.jsx'), 'utf8')
  const overview = readFileSync(join(__dirname, '../src/components/WorkspaceOverview.jsx'), 'utf8')
  const css = readFileSync(join(__dirname, '../src/workspace-v1.css'), 'utf8')
  assert(app.includes('<WorkspaceShell'))
  assert(app.includes('<WorkspaceOverview'))
  for (const id of ['workspace-discovery','workspace-opportunities','workspace-outreach','workspace-followups','workspace-settings'])
    assert(app.includes(`id="${id}"`), `Missing anchor: ${id}`)
  assert(overview.includes('id="workspace-overview"'))
  assert(app.includes('onClick={() => void handleFindOpportunities()}'))
  assert(app.includes('onClick={() => void approveOpportunity(lead)}'))
  assert(app.includes('onClick={() => void markOutreachAsSent(lead)}'))
  assert(shell.includes('onClick={onSignOut}'))
  assert(shell.includes('aria-pressed={selected}'))
  assert(css.includes('@media(max-width:1000px)'))
  assert(css.includes('prefers-reduced-motion'))
})

test('overview distinguishes configured sources from live availability', () => {
  const overview = readFileSync(join(__dirname, '../src/components/WorkspaceOverview.jsx'), 'utf8')
  assert(overview.includes('Configured does not mean currently available.'))
  assert(overview.includes('sourcesLoading'))
})


test('unified search remains read-only and routes discovery explicitly', () => {
  const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8')
  const page = readFileSync(join(__dirname, '../src/components/UnifiedSearchPage.jsx'), 'utf8')
  assert(app.includes("setActivePage('search')"))
  assert(app.includes('<UnifiedSearchPage'))
  assert(app.includes("onOpenDiscovery={() => navigateWorkspaceSection('discovery')}"))
  assert(!page.includes('triggerOpportunityEngine'))
  assert(!page.includes('supabase.from('))
  assert(page.includes('Search your client opportunities'))
})


test('Sources Hub uses existing provider monitoring and does not claim new integrations', () => {
  const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8')
  const page = readFileSync(join(__dirname, '../src/components/SourcesHubPage.jsx'), 'utf8')
  assert(app.includes("setActivePage('sources')"))
  assert(app.includes('<SourcesHubPage'))
  assert(page.includes('buildProviderMonitorRows'))
  assert(page.includes('Direct API unavailable'))
  assert(page.includes('<QuickCapturePanel'))
  assert(page.includes('workspaceId={workspaceId}'))
  assert(!page.includes('supabase.from('))
  assert(!page.includes('triggerOpportunityEngine'))
})


test('Search, Sources and Discovery link through a shared non-triggering journey', () => {
  const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8')
  const journey = readFileSync(join(__dirname, '../src/components/DiscoveryJourneyNav.jsx'), 'utf8')
  const search = readFileSync(join(__dirname, '../src/components/UnifiedSearchPage.jsx'), 'utf8')
  const sources = readFileSync(join(__dirname, '../src/components/SourcesHubPage.jsx'), 'utf8')
  const discovery = readFileSync(join(__dirname, '../src/components/DiscoveryRunPanel.jsx'), 'utf8')
  assert(app.includes('<DiscoveryJourneyNav active={activePage} onNavigate={navigateWorkspaceSection} />'))
  assert(app.includes('<DiscoveryJourneyNav active="discovery" onNavigate={navigateWorkspaceSection} />'))
  assert(app.includes("onManageSources={() => navigateWorkspaceSection('sources')}"))
  assert(app.includes("onBrowseResults={() => navigateWorkspaceSection('search')}"))
  assert(app.includes("onNewDiscovery={() => navigateWorkspaceSection('discovery')}"))
  assert(journey.includes('Viewing this page does not start a search'))
  assert(journey.includes('Only pressing Find Opportunities'))
  assert(!journey.includes('triggerOpportunityEngine'))
  assert(!search.includes('triggerOpportunityEngine'))
  assert(!sources.includes('triggerOpportunityEngine'))
  assert(discovery.includes('Browse stored results'))
  assert(search.includes('New discovery uses your saved search profile'))
  assert(sources.includes('Neither action starts a provider request'))
})


test('saved search navigation is read-only and remains separate from acquisition', () => {
  const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8')
  const saved = readFileSync(join(__dirname, '../src/components/SavedSearchesPage.jsx'), 'utf8')
  const service = readFileSync(join(__dirname, '../src/services/savedOpportunitySearches.js'), 'utf8')
  assert(app.includes('<SavedSearchesPage'))
  assert(app.includes('setSavedSearchPreset(saved)'))
  assert(saved.includes('No scheduled alerts or paid searches'))
  assert(!saved.includes('triggerOpportunityEngine'))
  assert(service.includes(".from('saved_opportunity_searches')"))
  assert(!service.includes(".from('search_profiles')"))
})


test('Unified Search fetches real posting dates and explains unknown dates', () => {
  const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8')
  const search = readFileSync(join(__dirname, '../src/components/UnifiedSearchPage.jsx'), 'utf8')
  // The opportunity loader must select the same timestamp used by the recency filter.
  const fetchBlock = app.slice(app.indexOf('const fetchOpportunities = async'), app.indexOf('const loadBusinessProfile ='))
  assert(fetchBlock.includes('published_at,'))
  assert(search.includes('const date = opportunity.published_at'))
  assert(search.includes('posted === null || posted < cutoff'))
  assert(search.includes('no verified posting date'))
  assert(search.includes('Use Any time to include undated opportunities'))
  assert(!search.includes('triggerOpportunityEngine'))
})
