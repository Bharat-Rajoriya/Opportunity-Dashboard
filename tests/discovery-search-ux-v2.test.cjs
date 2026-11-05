const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

const modulePromise = import(pathToFileURL(join(__dirname, '../src/services/discoveryPresentation.js')).href)

test('query summary combines unique AI and custom phrases only when AI enabled', async () => {
  const { getDiscoveryQuerySummary } = await modulePromise
  const input = { customQueries: [' wordpress website ', 'Build a landing page', 'WORDPRESS WEBSITE'],
    aiQueries: ['Build a landing page', 'Hire an SEO expert'], queryBatchSize: 10,
    enabledSources: ['google', 'freelancer', 'google'] }
  const included = getDiscoveryQuerySummary({ ...input, aiEnabled: true })
  assert.equal(included.customCount, 2)
  assert.equal(included.aiCount, 2)
  assert.equal(included.configuredCount, 3)
  assert.equal(included.selectedSources.length, 2)
  assert.equal(included.batchLimit, 10)
  assert.match(included.estimate, /Up to 3 configured phrases/)
  assert.match(included.estimate, /may reduce requests/)
  const excluded = getDiscoveryQuerySummary({ ...input, aiEnabled: false })
  assert.equal(excluded.configuredCount, 2)
  assert.equal(excluded.aiIncluded, false)
})

test('query summary does not invent requests when phrases are absent', async () => {
  const { getDiscoveryQuerySummary } = await modulePromise
  const empty = getDiscoveryQuerySummary({ aiQueries: [], customQueries: [], queryBatchSize: 5 })
  assert.equal(empty.configuredCount, 0)
  assert.match(empty.estimate, /Configure at least one search phrase/)
})

test('run states distinguish real completion, failure, polling and unknown status', async () => {
  const { getDiscoveryRunState } = await modulePromise
  assert.equal(getDiscoveryRunState({ run_status: 'completed' }).kind, 'success')
  assert.equal(getDiscoveryRunState({ run_status: 'failed' }).kind, 'error')
  assert.equal(getDiscoveryRunState({ run_status: 'running' }).kind, 'pending')
  assert.equal(getDiscoveryRunState(null).kind, 'neutral')
  assert.equal(getDiscoveryRunState({ run_status: 'failed' }, true).kind, 'running')
  assert.match(getDiscoveryRunState({}, true).detail, /Individual step timings are not available/)
})

test('diagnostics preserve event stage counts and explain rejection evidence', async () => {
  const { getDiscoveryBreakdown } = await modulePromise
  const details = getDiscoveryBreakdown({
    counts: { evaluated: 30, rejected: 27, qualified: 3, duplicate: 2, created: 1 },
    sourceCounts: {
      freelancer: { evaluated: 30, rejected: 27, qualified: 3, duplicate: 2, created: 1 },
      google: { evaluated: 0, created: 0 },
    },
    reasons: { ai_not_opportunity: 16, service_match_unsupported: 5, unknown_gate_reason: 6 },
    truncated: false,
  })
  assert.equal(details.counts.created, 1)
  assert.equal(details.counts.duplicate, 2)
  assert.deepEqual(details.reasons.map(x => x.count), [16,6,5])
  assert.equal(details.reasons[0].label, 'Not a buyer request')
  assert.equal(details.reasons[2].label, 'Service match lacks evidence')
  assert.equal(details.sources[0].source, 'freelancer')
  assert.match(details.note, /do not add the columns together/)
  assert.equal(details.truncated, false)
})

test('diagnostics handle missing or invalid numbers conservatively', async () => {
  const { getDiscoveryBreakdown } = await modulePromise
  assert.equal(getDiscoveryBreakdown(null), null)
  const d = getDiscoveryBreakdown({
    counts: { evaluated: -5, rejected: 'not a number' },
    reasons: { '<script>': 'not a number', 'ai_not_opportunity': 3 },
    truncated: true,
  })
  assert.equal(d.counts.evaluated, 0)
  assert.equal(d.counts.rejected, 0)
  assert.equal(d.reasons.length, 1)
  assert.equal(d.truncated, true)
})

test('discovery panel and query editor are connected without bypassing saved search behavior', () => {
  const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8')
  const panel = readFileSync(join(__dirname, '../src/components/DiscoveryRunPanel.jsx'), 'utf8')
  const editor = readFileSync(join(__dirname, '../src/components/DiscoveryQueryEditor.jsx'), 'utf8')
  const styles = readFileSync(join(__dirname, '../src/discovery-v2.css'), 'utf8')
  assert(app.includes('<DiscoveryRunPanel'))
  assert(app.includes('<DiscoveryQueryEditor'))
  assert(app.includes('onClick={() => void handleFindOpportunities()}'))
  assert(app.includes('onRegenerate={() => void handleRegenerateAiQueries()}'))
  assert(app.includes('onCustomChange={setSearchQueries}'))
  assert(app.includes('onAiEnabledChange={setAiQueryGenerationEnabled}'))
  assert(app.includes('onClick={() => void saveSearchSettings()}'))
  assert(app.includes('id="workspace-discovery"'))
  assert(panel.includes('getDiscoveryRunState(run, running)'))
  assert(panel.includes('getDiscoveryBreakdown(diagnostics)'))
  assert(panel.includes('Selected sources are not necessarily online or within quota.'))
  assert(editor.includes('id="advanced-search-queries"'))
  assert(editor.includes('Changes here are not active until you select'))
  assert(styles.includes('@media(max-width:740px)'))
  assert(styles.includes('prefers-reduced-motion'))
})
