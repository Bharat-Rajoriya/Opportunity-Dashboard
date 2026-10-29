const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const source = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8').replace(/\r\n/g, '\n')
const start = source.indexOf('  const loadSearchProfile = useCallback(')
const end = source.indexOf('  const loadReviewQueue = useCallback(', start)
assert(start >= 0 && end > start)

function normalizeSearchList(items) {
  if (!Array.isArray(items)) return []
  const seen = new Set()
  return items
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase()
      if (!item || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const profile = {
  id: 'profile-1',
  workspace_id: 'workspace-1',
  name: 'Primary search',
  source: 'google',
  search_queries: [' WordPress developer ', 'wordpress developer', 'Shopify work'],
  target_countries: ['USA', ' UK ', 'usa'],
  min_intent_level: '4',
  max_age_hours: '48',
  active: true,
  updated_at: '2026-10-14T10:00:00.000Z',
}

function setup(options = {}) {
  const initialProfile = options.searchProfile === undefined ? profile : options.searchProfile
  const state = {
    profile: initialProfile,
    queries: options.searchQueries ?? [...profile.search_queries],
    countries: options.targetCountries ?? [...profile.target_countries],
    intent: options.minIntentLevel ?? 3,
    freshness: options.maxAgeHours ?? 72,
    loading: false,
    saving: false,
    error: 'old error',
    message: 'old message',
  }
  const calls = []
  const request = { current: 0 }
  const pending = { current: false }
  let updatePayload

  const env = {
    useCallback: (handler) => handler,
    SEARCH_PROFILE_FIELDS: 'id, workspace_id, search_queries, target_countries',
    normalizeSearchList,
    workspace: options.workspace === undefined ? { id: 'workspace-1' } : options.workspace,
    searchProfile: initialProfile,
    searchQueries: state.queries,
    targetCountries: state.countries,
    minIntentLevel: state.intent,
    maxAgeHours: state.freshness,
    searchSettingsLoading: options.loading ?? false,
    searchSettingsRequest: request,
    searchSettingsSavePendingRef: pending,
    setSearchProfile(value) { state.profile = value },
    setSearchQueries(value) { state.queries = value },
    setTargetCountries(value) { state.countries = value },
    setMinIntentLevel(value) { state.intent = value },
    setMaxAgeHours(value) { state.freshness = value },
    setSearchSettingsLoading(value) { state.loading = value },
    setSearchSettingsSaving(value) { state.saving = value },
    setSearchSettingsError(value) { state.error = value },
    setSearchSettingsMessage(value) { state.message = value },
    console: {
      log(...args) { calls.push(['log', ...args]) },
      error(...args) { calls.push(['errorLog', ...args]) },
    },
    supabase: {
      from(table) {
        calls.push(['from', table])
        const query = {
          select(fields) { calls.push(['select', fields]); return query },
          eq(column, value) { calls.push(['eq', column, value]); return query },
          order(column, settings) { calls.push(['order', column, settings]); return query },
          limit(value) { calls.push(['limit', value]); return query },
          maybeSingle() {
            calls.push(['maybeSingle'])
            if (options.readThrow) throw options.readThrow
            return Promise.resolve(options.readError
              ? { error: options.readError }
              : { data: options.loadedProfile === undefined ? profile : options.loadedProfile })
          },
          update(payload) {
            updatePayload = payload
            calls.push(['update', payload])
            return query
          },
          single() {
            calls.push(['single'])
            if (options.writeThrow) throw options.writeThrow
            return Promise.resolve(options.writeError
              ? { error: options.writeError }
              : {
                data: options.savedProfile === undefined
                  ? { ...profile, ...updatePayload }
                  : options.savedProfile,
              })
          },
        }
        return query
      },
    },
  }

  const actions = new Function(
    ...Object.keys(env),
    source.slice(start, end) + 'return { loadSearchProfile, saveSearchSettings }'
  )(...Object.values(env))

  return { ...actions, state, calls, request, pending }
}

test('loads the first active workspace profile with maybeSingle and normalizes editable values', async () => {
  const h = setup()
  await h.loadSearchProfile('workspace-1')

  assert.deepEqual(h.calls.filter(([kind]) => kind === 'eq'), [
    ['eq', 'workspace_id', 'workspace-1'],
    ['eq', 'active', true],
  ])
  assert.deepEqual(h.calls.find(([kind]) => kind === 'order'), [
    'order', 'created_at', { ascending: true },
  ])
  assert.deepEqual(h.calls.find(([kind]) => kind === 'limit'), ['limit', 1])
  assert(h.calls.some(([kind]) => kind === 'maybeSingle'))
  assert.deepEqual(h.state.queries, ['WordPress developer', 'Shopify work'])
  assert.deepEqual(h.state.countries, ['USA', 'UK'])
  assert.equal(h.state.intent, 4)
  assert.equal(h.state.freshness, 48)
  assert.equal(h.state.loading, false)
})

test('a workspace without an active search profile remains an editable empty state without an error', async () => {
  const h = setup({ loadedProfile: null })
  await h.loadSearchProfile('workspace-1')

  assert.equal(h.state.profile, null)
  assert.deepEqual(h.state.queries, [])
  assert.deepEqual(h.state.countries, [])
  assert.equal(h.state.error, '')
  assert.equal(h.state.loading, false)
})

test('save normalizes values and scopes the confirmed update by profile and workspace', async () => {
  const h = setup({
    searchQueries: [' WordPress developer ', 'wordpress developer', '', ' Shopify work '],
    targetCountries: [' USA ', 'UK', 'usa'],
    minIntentLevel: '4',
    maxAgeHours: '168',
  })
  await h.saveSearchSettings()

  assert.deepEqual(h.calls.find(([kind]) => kind === 'update')[1], {
    search_queries: ['WordPress developer', 'Shopify work'],
    target_countries: ['USA', 'UK'],
    min_intent_level: 4,
    max_age_hours: 168,
  })
  assert.deepEqual(h.calls.filter(([kind]) => kind === 'eq'), [
    ['eq', 'id', 'profile-1'],
    ['eq', 'workspace_id', 'workspace-1'],
  ])
  assert(h.calls.some(([kind]) => kind === 'single'))
  assert.equal(h.state.message, 'Search settings saved.')
  assert.equal(h.state.error, '')
  assert.equal(h.state.saving, false)
  assert.equal(h.pending.current, false)
})

test('save requires an active profile owned by the current workspace', async () => {
  for (const options of [
    { searchProfile: null },
    { searchProfile: { ...profile, workspace_id: 'workspace-2' } },
    { workspace: null },
  ]) {
    const h = setup(options)
    await h.saveSearchSettings()
    assert(!h.calls.some(([kind]) => kind === 'update'))
    assert.match(h.state.error, /active search profile/i)
  }
})

test('failed saves preserve the editable values and release the save lock', async () => {
  const h = setup({
    searchQueries: ['Keep this query'],
    targetCountries: ['India'],
    writeError: { message: 'Write denied' },
  })
  await h.saveSearchSettings()

  assert.deepEqual(h.state.queries, ['Keep this query'])
  assert.deepEqual(h.state.countries, ['India'])
  assert.equal(h.state.error, 'Write denied')
  assert.equal(h.state.saving, false)
  assert.equal(h.pending.current, false)
})

test('settings render the advanced query editor, market checkboxes, and constrained selectors', () => {
  const dashboard = source.slice(
    source.indexOf("{activePage === 'settings' && ("),
    source.indexOf('// FILTER BAR')
  )

  for (const expected of [
    'Advanced Search Queries',
    'id="advanced-search-queries"',
    'Target Markets',
    'Opportunity Quality',
    'type="checkbox"',
    'Minimum Intent Level',
    'Opportunity Freshness',
    'Save Changes',
  ]) {
    assert(dashboard.includes(expected))
  }
  assert(!dashboard.includes('Add Search Query'))
  assert(!dashboard.includes('JSON'))
})
