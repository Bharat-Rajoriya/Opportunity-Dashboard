const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const app = fs.readFileSync('src/App.jsx', 'utf8')
const api = fs.readFileSync('src/services/opportunityEngine.js', 'utf8')
const provider = fs.readFileSync('src/services/providerHealth.js', 'utf8')
const monitor = fs.readFileSync('src/components/ProviderHealthMonitor.jsx', 'utf8')

test('monitor loads last persisted run independently of transient engineRun state', () => {
  const section = app.slice(app.indexOf('const loadProviderMonitor = useCallback('),app.indexOf('const loadSourceAnalytics = useCallback('))
  assert.match(section,/getLatestEngineRun\(workspaceId\)/)
  assert.match(section,/setMonitorLatestRun\(latestRun\)/)
  assert.match(section,/fetchLastRunSourceCounts\(workspaceId, latestRun\.master_execution_id\)/)
  assert.doesNotMatch(section,/engineRun\?\.master_execution_id/)
})

test('latest persisted run respects workspace and newest created timestamp', () => {
  assert.match(api,/\.from\('engine_runs'\)[\s\S]*?\.eq\('workspace_id', workspaceId\)[\s\S]*?\.order\('created_at', \{ ascending: false \}\)/)
  assert.match(provider,/\.from\('source_candidate_events'\)[\s\S]*?\.eq\('workspace_id', workspaceId\)[\s\S]*?\.eq\('master_execution_id', String\(masterExecutionId\)\)/)
})

test('initial load, manual refresh and completed discovery refresh monitor', () => {
  assert.match(app,/if \(workspace\?\.onboarding_completed\) \{\s*void loadProviderMonitor\(workspace\.id\)/)
  assert.match(app,/engineRun\?\.master_execution_id, loadProviderMonitor/)
  assert.match(app,/void loadProviderMonitor\(workspace\.id\)/)
  assert.match(app,/engineRun=\{monitorLatestRun\}/)
  assert.doesNotMatch(app,/loadProviderMonitor\(workspace\.id, engineRun\?\.master_execution_id\)/)
  assert.match(monitor,/Latest run:/)
})

test('workspace switches and stale asynchronous responses do not mix source counts', () => {
  const section = app.slice(app.indexOf('const loadProviderMonitor = useCallback('),app.indexOf('const loadSourceAnalytics = useCallback('))
  assert.match(section,/const requestId = \+\+providerMonitorRequest\.current/)
  assert.match(section,/if \(requestId !== providerMonitorRequest\.current\) return/g)
  assert.match(section,/setLastRunSourceCounts\(\{\}\)/)
  assert.match(section,/setMonitorLatestRun\(null\)/)
})

test('monitor refresh only reads provider and event data; it does not trigger discovery', () => {
  const section = app.slice(app.indexOf('const loadProviderMonitor = useCallback('),app.indexOf('const loadSourceAnalytics = useCallback('))
  assert.doesNotMatch(section,/triggerOpportunityEngine|FindOpportunities/)
  assert.match(section,/fetchProviderHealth\(workspaceId\)/)
})
