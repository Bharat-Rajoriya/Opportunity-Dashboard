const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

const load = import(pathToFileURL(join(__dirname, '../src/config/workspaceUi.js')).href)

test('workspace navigation includes eight unique real sections', async () => {
  const { WORKSPACE_SECTIONS, getWorkspaceSection } = await load
  assert.deepEqual(WORKSPACE_SECTIONS.map(item => item.id), [
    'overview', 'search', 'discovery', 'opportunities', 'outreach', 'followups', 'diagnostics', 'settings',
  ])
  assert.equal(new Set(WORKSPACE_SECTIONS.map(item => item.target)).size, 8)
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
