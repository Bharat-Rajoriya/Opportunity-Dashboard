const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const appSource = readFileSync(
  join(__dirname, '../src/App.jsx'),
  'utf8'
).replace(/\r\n/g, '\n')

const serviceSource = readFileSync(
  join(__dirname, '../src/services/searchProfiles.js'),
  'utf8'
).replace(/\r\n/g, '\n')

test('search settings are routed through the search profile service', () => {
  for (const expected of [
    "fetchActiveSearchProfile",
    "saveActiveSearchProfile",
    "fetchSearchProfileById",
    "normalizeSearchList",
  ]) {
    assert(appSource.includes(expected))
  }

  assert(
    !appSource.includes(
      ".from('search_profiles')\n        .select(SEARCH_PROFILE_FIELDS)"
    )
  )
})

test('search profile service scopes reads and writes to the workspace', () => {
  for (const expected of [
    ".from('search_profiles')",
    ".eq('workspace_id', workspaceId)",
    ".eq('active', true)",
    ".eq('id', profileId)",
    ".single()",
    ".maybeSingle()",
  ]) {
    assert(serviceSource.includes(expected))
  }
})

test('search profile service persists AI query settings and batch size', () => {
  for (const expected of [
    'ai_query_generation_enabled',
    'ai_suggested_queries',
    'ai_queries_generated_at',
    'query_cursor',
    'query_batch_size',
  ]) {
    assert(serviceSource.includes(expected))
  }

  assert(serviceSource.includes('Boolean(aiQueryGenerationEnabled)'))
  assert(serviceSource.includes('Number(queryBatchSize)'))
})

test('normalizeSearchList trims and removes case-insensitive duplicates', () => {
  const start = serviceSource.indexOf(
    'export function normalizeSearchList(items) {'
  )
  const end = serviceSource.indexOf(
    '\nexport async function fetchActiveSearchProfile',
    start
  )

  assert(start >= 0 && end > start)

  const functionSource = serviceSource
    .slice(start, end)
    .replace('export function', 'function')

  const normalizeSearchList = new Function(
    functionSource + '\nreturn normalizeSearchList'
  )()

  assert.deepEqual(
    normalizeSearchList([
      ' WordPress developer ',
      'wordpress developer',
      '',
      ' Shopify work ',
    ]),
    ['WordPress developer', 'Shopify work']
  )
})

test('settings render AI controls, advanced query editor and constrained selectors', () => {
  const dashboard = appSource.slice(
    appSource.indexOf("{activePage === 'settings' && ("),
    appSource.indexOf('// FILTER BAR')
  )

  for (const expected of [
    'Search Query Sources',
    'AI-generated queries',
    'Include AI queries',
    'Regenerate',
    'Custom search queries',
    'Edit queries',
    'id="advanced-search-queries"',
    'Search Run Size',
    'Queries used per run',
    'Target Markets',
    'Minimum Intent Level',
    'Opportunity Freshness',
    'Save Changes',
  ]) {
    assert(dashboard.includes(expected))
  }

  assert(!dashboard.includes('JSON'))
})


test('query-source UX separates source selection from run size and keeps AI feedback local', () => {
  const dashboard = appSource.slice(
    appSource.indexOf("{activePage === 'settings' && ("),
    appSource.indexOf('// FILTER BAR')
  )

  assert(
    dashboard.indexOf('Search Query Sources') <
      dashboard.indexOf('Search Run Size')
  )

  assert(
    dashboard.includes(
      'It selects from your enabled AI queries and your custom query list.'
    )
  )

  assert(
    dashboard.includes(
      "searchSettingsMessage?.startsWith(\n                              'AI queries regenerated'"
    ) ||
    dashboard.includes(
      "searchSettingsMessage?.startsWith(\n                            'AI queries regenerated'"
    )
  )

  assert(
    dashboard.includes(
      "!searchSettingsMessage.startsWith(\n                          'AI queries regenerated'"
    ) ||
    dashboard.includes(
      "!searchSettingsMessage.startsWith(\n                        'AI queries regenerated'"
    )
  )

  assert(!dashboard.includes('Advanced Search Queries'))
  assert(!dashboard.includes('Enable AI-generated queries'))
  assert(!dashboard.includes('Queries per search run'))
})
