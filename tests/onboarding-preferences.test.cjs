const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

// Exercise the actual component handlers without a browser or live Supabase writes.
const source = readFileSync(join(__dirname, '../src/components/Onboarding.jsx'), 'utf8')
  .replace(/\r\n/g, '\n')
const helpers = new Function(
  source.slice(source.indexOf('const idealListFields'), source.indexOf('function Onboarding')) +
    'return { idealListFields, normalizeIdealItems, createIdealForm, emptyPortfolioForm, parseCommaList, parseLines }'
)()

function handler(name, env) {
  const start = source.indexOf('  const ' + name + ' =')
  const end = name === 'loadBusinessProfile'
    ? source.indexOf('\n  useEffect(() => {\n    setCurrentStep(1)', start)
    : name === 'handleSave'
      ? source.indexOf('\n  if (loading)', start)
      : source.indexOf('\n  const ', start + 1)
  assert(start >= 0 && end > start, 'Handler extraction: ' + name)
  const bindings = Object.entries(env).filter(([key]) => key !== name)
  return new Function(...bindings.map(([key]) => key), source.slice(start, end) + 'return ' + name)(
    ...bindings.map(([, value]) => value)
  )
}

function setup(options = {}) {
  const state = { IdealForm: helpers.createIdealForm(), CurrentStep: 3 }
  const calls = []
  const env = {
    ...helpers,
    useCallback: (callback) => callback,
    workspaceId: 'workspace-1',
    loading: false,
    profileLoadError: '',
    profileLoadRequest: { current: 1 },
    idealSavePending: { current: false },
    profileSavePending: { current: false },
    searchLoadRequest: { current: 0 },
    searchProfileId: { current: null },
    searchSavePending: { current: false },
    portfolioLoadRequest: { current: 0 },
    portfolioMutationPendingRef: { current: false },
    completionPendingRef: { current: false },
    workspace: { id: 'workspace-1', owner_user_id: 'user-1' },
    user: { id: 'user-1' },
    onComplete: (workspace) => { calls.push(['onComplete', workspace]) },
    window: { location: { reload() { calls.push(['reloadPage']) } } },
    portfolioLoading: false,
    portfolioLoadError: '',
    showPortfolioForm: false,
    editingPortfolioId: null,
    portfolioForm: {
      project_name: ' Website rebuild ', client_name: ' Client ', industry: ' Technology ',
      services: ' Website, SEO, website, , ', technologies: ' WordPress, Elementor, ',
      project_url: ' https://example.com ', summary: ' Redesigned website ',
      proof_points: ' Faster website\n\n Custom templates\r\n ',
    },
    loadPortfolioItems: async () => { calls.push(['reloadPortfolio']); return options.refreshed !== false },
    searchLoading: false,
    searchLoadError: '',
    servicesLoading: false,
    serviceMutationPending: false,
    searchForm: { min_intent_level: 3, max_age_hours: 72, active: true },
    services: [{ name: 'Shopify', keywords: ['Liquid'], active: true }],
    idealForm: {
      target_countries: [' USA ', 'usa'],
      ideal_client_types: ['Agencies'],
      rejection_rules: [],
      good_opportunity_definition: '  Paid website work  ',
    },
    countryInput: ' UK ',
    clientTypeInput: ' agencies ',
    rejectionRuleInput: ' Unpaid work ',
    businessName: ' My Business ',
    businessType: 'freelancer',
    websiteUrl: '',
    primaryGoal: ' Find clients ',
    preferredLanguage: 'English',
    console: { error() {} },
    ...options.env,
  }
  for (const key of [
    'IdealForm', 'IdealMessage', 'IdealSaving', 'CountryInput', 'ClientTypeInput',
    'RejectionRuleInput', 'CurrentStep', 'BusinessName', 'BusinessType',
    'WebsiteUrl', 'PrimaryGoal', 'PreferredLanguage', 'Loading', 'Saving',
    'ProfileLoadError', 'Message', 'SearchForm', 'SearchMessage',
    'SearchLoading', 'SearchLoadError', 'SearchSaving',
    'PortfolioItems', 'PortfolioLoading', 'PortfolioMessage',
    'PortfolioLoadError', 'PortfolioForm', 'ShowPortfolioForm', 'EditingPortfolioId',
    'PortfolioSaving', 'PortfolioTogglingId',
    'CompletingSetup',
  ]) {
    env['set' + key] = (value) => {
      state[key] = typeof value === 'function' ? value(state[key]) : value
    }
  }
  state.PortfolioForm = env.portfolioForm
  state.ShowPortfolioForm = env.showPortfolioForm
  state.EditingPortfolioId = env.editingPortfolioId
  env.supabase = {
    from(table) {
      calls.push(['from', table])
      let mutation = false
      const query = {
        select(columns) { calls.push(['select', columns]); return query },
        eq(key, value) { calls.push(['eq', key, value]); return query },
        limit(count) { calls.push(['limit', count]); return query },
        async order(column, optionsValue) {
          calls.push(['order', column, optionsValue])
          if (options.read) return options.read()
          if (options.readThrown) throw options.readThrown
          return { data: options.profile === undefined ? [] : options.profile, error: options.readError }
        },
        update(payload) { mutation = true; calls.push(['update', payload]); return query },
        insert(payload) { mutation = true; calls.push(['insert', payload]); return query },
        async maybeSingle() {
          calls.push(['maybeSingle'])
          if (options.read) return options.read()
          if (options.readThrown) throw options.readThrown
          return { data: options.profile === undefined ? { id: 'profile-1' } : options.profile, error: options.readError }
        },
        async single() {
          assert(mutation)
          calls.push(['single'])
          if (options.write) return options.write()
          if (options.writeThrown) throw options.writeThrown
          return { data: options.saved === undefined ? { id: 'profile-1' } : options.saved, error: options.writeError }
        },
      }
      return query
    },
  }
  env.buildSearchQueries = handler('buildSearchQueries', env)
  return { env, state, calls }
}

test('normalization trims, removes empty/malformed entries, and deduplicates case-insensitively', () => {
  assert.deepEqual(helpers.normalizeIdealItems([' USA ', 'usa', '', null, 12, ' UK']), ['USA', 'UK'])
  assert.deepEqual(helpers.createIdealForm({ target_countries: 'USA', rejection_rules: null }), {
    target_countries: [], ideal_client_types: [], rejection_rules: [], good_opportunity_definition: '',
  })
})

test('tag helpers add/remove unique values and reject unknown fields', () => {
  const h = setup()
  const add = handler('addUniqueItem', h.env)
  add('target_countries', ' USA ')
  add('target_countries', 'usa')
  add('unknown', 'value')
  assert.deepEqual(h.state.IdealForm.target_countries, ['USA'])
  assert.equal(h.state.IdealForm.unknown, undefined)
  handler('removeItem', h.env)('target_countries', 'USA')
  assert.deepEqual(h.state.IdealForm.target_countries, [])
  h.env.idealSavePending.current = true
  add('target_countries', 'UK')
  assert.deepEqual(h.state.IdealForm.target_countries, [])
})

test('load restores Step 1 and normalized Step 3 answers using the workspace boundary', async () => {
  const h = setup({ profile: {
    business_name: 'Existing business', target_countries: ['USA', 'usa'],
    ideal_client_types: ['Agencies'], rejection_rules: ['Unpaid work'],
    good_opportunity_definition: 'Website projects',
  } })
  await handler('loadBusinessProfile', h.env)()
  assert.equal(h.state.BusinessName, 'Existing business')
  assert.deepEqual(h.state.IdealForm.target_countries, ['USA'])
  assert.equal(h.state.IdealForm.good_opportunity_definition, 'Website projects')
  assert(h.calls.some(([kind, key, value]) => kind === 'eq' && key === 'workspace_id' && value === 'workspace-1'))
  assert(h.calls.find(([kind]) => kind === 'select')[1].includes('rejection_rules'))
  assert.equal(h.state.Loading, false)
  assert.equal(h.state.CountryInput, '')
})

test('load with no profile resets defaults rather than retaining another workspace answers', async () => {
  const h = setup({ profile: null })
  await handler('loadBusinessProfile', h.env)()
  assert.deepEqual(h.state.IdealForm, helpers.createIdealForm())
  assert.equal(h.state.BusinessName, '')
  assert.equal(h.state.PreferredLanguage, 'English')
})

for (const options of [
  { readError: { message: 'Read denied' } },
  { readThrown: new Error('Network failure') },
  { env: { workspaceId: null } },
]) {
  test('load failure exits loading and surfaces a retryable error: ' + JSON.stringify(options), async () => {
    const h = setup(options)
    await handler('loadBusinessProfile', h.env)()
    assert(h.state.ProfileLoadError)
    assert.equal(h.state.Loading, false)
  })
}

test('stale profile response cannot overwrite answers or end a newer loading state', async () => {
  let resolve
  const h = setup({ read: () => new Promise((done) => { resolve = done }) })
  const pending = handler('loadBusinessProfile', h.env)()
  h.env.profileLoadRequest.current += 1
  resolve({ data: { business_name: 'Old workspace' } })
  await pending
  assert.equal(h.state.BusinessName, undefined)
  assert.equal(h.state.Loading, true)
})

test('save includes pending inputs, preserves Step 1 fields, and advances only after confirmed update', async () => {
  const h = setup()
  await handler('saveIdealOpportunities', h.env)()
  const payload = h.calls.find(([kind]) => kind === 'update')[1]
  assert.deepEqual(payload.target_countries, ['USA', 'UK'])
  assert.deepEqual(payload.ideal_client_types, ['Agencies'])
  assert.deepEqual(payload.rejection_rules, ['Unpaid work'])
  assert.equal(payload.good_opportunity_definition, 'Paid website work')
  assert.equal(payload.business_name, undefined)
  assert(!Number.isNaN(new Date(payload.updated_at).getTime()))
  assert(h.calls.some(([kind, key, value]) => kind === 'eq' && key === 'workspace_id' && value === 'workspace-1'))
  assert(h.calls.some(([kind, value]) => kind === 'select' && value === 'id'))
  assert.equal(h.state.CurrentStep, 4)
  assert.equal(h.state.CountryInput, '')
  assert.equal(h.state.IdealSaving, false)
})

test('blank optional description saves null; returning to onboarding restores saved answers', async () => {
  const h = setup({ env: { idealForm: {
    target_countries: ['USA'], ideal_client_types: ['Founders'],
    rejection_rules: [], good_opportunity_definition: '   ',
  } } })
  await handler('saveIdealOpportunities', h.env)()
  const payload = h.calls.find(([kind]) => kind === 'update')[1]
  assert.equal(payload.good_opportunity_definition, null)
  const loaded = setup({ profile: payload })
  await handler('loadBusinessProfile', loaded.env)()
  assert.deepEqual(loaded.state.IdealForm.target_countries, payload.target_countries)
  assert.equal(loaded.state.IdealForm.good_opportunity_definition, '')
})

for (const field of ['target_countries', 'ideal_client_types']) {
  test('required ' + field + ' validation prevents a write', async () => {
    const h = setup({ env: {
      idealForm: { target_countries: ['USA'], ideal_client_types: ['Agencies'], rejection_rules: [] },
      countryInput: '', clientTypeInput: '',
    } })
    h.env.idealForm[field] = ['  ']
    await handler('saveIdealOpportunities', h.env)()
    assert.equal(h.calls.length, 0)
    assert(h.state.IdealMessage.includes('at least one'))
  })
}

for (const options of [
  { writeError: { message: 'Permission denied' } },
  { writeThrown: new Error('Network failure') },
  { saved: null },
]) {
  test('failed or zero-row save retains the draft and stays on Step 3: ' + JSON.stringify(options), async () => {
    const h = setup(options)
    await handler('saveIdealOpportunities', h.env)()
    assert.equal(h.state.CurrentStep, 3)
    assert(h.state.IdealMessage)
    assert.equal(h.state.CountryInput, undefined)
    assert.equal(h.env.countryInput, ' UK ')
    assert.equal(h.state.IdealSaving, false)
    assert.equal(h.env.idealSavePending.current, false)
  })
}

test('double submission is locked immediately and stale save cannot advance another workspace', async () => {
  let resolve
  const h = setup({ write: () => new Promise((done) => { resolve = done }) })
  const save = handler('saveIdealOpportunities', h.env)
  const pending = save()
  await save()
  assert.equal(h.calls.filter(([kind]) => kind === 'update').length, 1)
  h.env.profileLoadRequest.current += 1
  resolve({ data: { id: 'old-profile' } })
  await pending
  assert.equal(h.state.CurrentStep, 3)
  assert.equal(h.state.CountryInput, undefined)
  assert.equal(h.env.idealSavePending.current, false)
})

for (const env of [{ loading: true }, { profileLoadError: 'Read denied' }, { workspaceId: null }]) {
  test('save does not write before a successful load and workspace: ' + JSON.stringify(env), async () => {
    const h = setup({ env })
    await handler('saveIdealOpportunities', h.env)()
    assert.equal(h.calls.length, 0)
    assert.equal(h.state.CurrentStep, 3)
  })
}

for (const profile of [{ id: 'profile-1' }, null]) {
  test('Step 1 ' + (profile ? 'update' : 'insert') + ' confirms persistence without overwriting Step 3', async () => {
    const h = setup({ profile })
    await handler('handleSave', h.env)({ preventDefault() {} })
    const kind = profile ? 'update' : 'insert'
    const payload = h.calls.find(([call]) => call === kind)[1]
    assert.equal(payload.workspace_id, 'workspace-1')
    assert.equal(payload.target_countries, undefined)
    assert.equal(payload.good_opportunity_definition, undefined)
    assert.equal(h.state.CurrentStep, 2)
    assert.equal(h.state.Saving, false)
    if (profile) assert(h.calls.some(([call, key, value]) => call === 'eq' && key === 'id' && value === profile.id))
  })
}

test('Step 1 network or zero-row failures do not advance and release the save lock', async () => {
  for (const options of [{ readThrown: new Error('Offline') }, { writeThrown: new Error('Offline') }, { saved: null }]) {
    const h = setup(options)
    await handler('handleSave', h.env)({ preventDefault() {} })
    assert.equal(h.state.CurrentStep, 3)
    assert(h.state.Message)
    assert.equal(h.state.Saving, false)
    assert.equal(h.env.profileSavePending.current, false)
  }
})

test('search loader reuses the workspace row, converts numeric strings, and preserves inactive status', async () => {
  const h = setup({ profile: {
    id: 'search-1', min_intent_level: '4', max_age_hours: '48', active: false,
  } })
  await handler('loadSearchProfile', h.env)()
  assert.deepEqual(h.state.SearchForm, { min_intent_level: 4, max_age_hours: 48, active: false })
  assert.equal(h.env.searchProfileId.current, 'search-1')
  assert.deepEqual(h.calls, [
    ['from', 'search_profiles'], ['select', '*'], ['eq', 'workspace_id', 'workspace-1'],
    ['limit', 1], ['maybeSingle'],
  ])
})

test('missing search row keeps defaults and never creates a duplicate', async () => {
  const h = setup({ profile: null })
  h.env.searchProfileId.current = 'old-search'
  await handler('loadSearchProfile', h.env)()
  assert.deepEqual(h.state.SearchForm, { min_intent_level: 3, max_age_hours: 72, active: true })
  assert.equal(h.env.searchProfileId.current, null)
  assert(!h.calls.some(([kind]) => kind === 'insert' || kind === 'update'))
})

test('invalid search numbers use defaults instead of NaN, infinite, or negative values', async () => {
  for (const value of [undefined, null, '', 'bad', Infinity, -1, 0]) {
    const h = setup({ profile: { id: 'search-1', min_intent_level: value, max_age_hours: value, active: null } })
    await handler('loadSearchProfile', h.env)()
    assert.deepEqual(h.state.SearchForm, { min_intent_level: 3, max_age_hours: 72, active: true })
  }
})

test('search loader without workspace resets stale state and performs no query', async () => {
  const h = setup({ env: { workspaceId: null } })
  h.env.searchProfileId.current = 'old-search'
  await handler('loadSearchProfile', h.env)()
  assert.equal(h.calls.length, 0)
  assert.equal(h.env.searchProfileId.current, null)
  assert.deepEqual(h.state.SearchForm, { min_intent_level: 3, max_age_hours: 72, active: true })
})

test('search read and network failures are caught and retained for the future UI', async () => {
  for (const options of [{ readError: { message: 'Read denied' } }, { readThrown: new Error('Offline') }]) {
    const h = setup(options)
    await handler('loadSearchProfile', h.env)()
    assert(h.state.SearchMessage)
    assert.equal(h.env.searchProfileId.current, null)
  }
})

test('late search results or errors cannot overwrite a newer workspace state', async () => {
  for (const response of [
    { data: { id: 'old-search', min_intent_level: 5, max_age_hours: 12, active: false } },
    { error: { message: 'Old workspace error' } },
  ]) {
    let resolve
    const h = setup({ read: () => new Promise((done) => { resolve = done }) })
    const pending = handler('loadSearchProfile', h.env)()
    h.env.searchLoadRequest.current += 1
    h.env.searchProfileId.current = 'new-search'
    h.state.SearchForm = { min_intent_level: 2, max_age_hours: 24, active: true }
    resolve(response)
    await pending
    assert.equal(h.env.searchProfileId.current, 'new-search')
    assert.deepEqual(h.state.SearchForm, { min_intent_level: 2, max_age_hours: 24, active: true })
    assert.equal(h.state.SearchMessage, '')
  }
})

test('existing workspace effect invokes all profile/portfolio loaders and invalidates them on cleanup', () => {
  const start = source.indexOf('  useEffect(() => {\n    setCurrentStep(1)')
  const end = source.indexOf('  const addUniqueItem', start)
  let cleanup
  const calls = []
  const profileRequest = { current: 1 }
  const searchRequest = { current: 2 }
  const portfolioRequest = { current: 3 }
  new Function(
    'useEffect', 'setCurrentStep', 'loadBusinessProfile', 'loadSearchProfile',
    'loadPortfolioItems', 'profileLoadRequest', 'searchLoadRequest', 'portfolioLoadRequest',
    'setShowPortfolioForm', 'setEditingPortfolioId', 'setPortfolioForm',
    'setPortfolioSaving', 'setPortfolioTogglingId', 'emptyPortfolioForm',
    'setCompletingSetup',
    source.slice(start, end)
  )(
    (effect) => { cleanup = effect() },
    (step) => calls.push(['step', step]),
    () => calls.push(['business']),
    () => calls.push(['search']),
    () => calls.push(['portfolio']),
    profileRequest, searchRequest, portfolioRequest,
    () => {}, () => {}, () => {}, () => {}, () => {}, helpers.emptyPortfolioForm,
    () => {},
  )
  assert.deepEqual(calls, [['step', 1], ['business'], ['search'], ['portfolio']])
  cleanup()
  assert.equal(profileRequest.current, 2)
  assert.equal(searchRequest.current, 3)
  assert.equal(portfolioRequest.current, 4)
})

test('query generator uses only active services, caps keywords, and deduplicates casing', () => {
  const h = setup({ env: { services: [
    { name: ' Shopify ', active: true, keywords: ['shopify', ' Liquid ', '', null, 99, 'sixth'] },
    { name: 'shopify', active: true, keywords: [] },
    { name: 'WordPress', active: false, keywords: ['WooCommerce'] },
    { name: 123, active: true, keywords: 'not an array' },
  ] } })
  assert.deepEqual(h.env.buildSearchQueries(), [
    'looking for Shopify', 'need Shopify', 'seeking Shopify', 'hiring Shopify',
    'looking for Liquid', 'need Liquid',
  ])
})

test('search save updates the loaded row with both boundaries and preserves its source', async () => {
  const h = setup({ profile: { id: 'search-existing' }, saved: { id: 'search-existing' } })
  h.env.searchProfileId.current = 'search-existing'
  await handler('saveSearchPreferences', h.env)()
  const payload = h.calls.find(([kind]) => kind === 'update')[1]
  assert.equal(payload.name, 'Primary Opportunity Search')
  assert.equal(payload.workspace_id, 'workspace-1')
  assert.deepEqual(payload.search_queries, h.env.buildSearchQueries())
  assert.deepEqual(payload.target_countries, ['USA'])
  assert.equal(payload.source, undefined)
  assert.equal(payload.min_intent_level, 3)
  assert.equal(payload.max_age_hours, 72)
  assert.equal(payload.active, true)
  assert.equal(h.calls.filter(([kind, key, value]) => kind === 'eq' && key === 'workspace_id' && value === 'workspace-1').length, 2)
  assert.equal(h.calls.filter(([kind, key, value]) => kind === 'eq' && key === 'id' && value === 'search-existing').length, 2)
  assert(!h.calls.some(([kind]) => kind === 'insert'))
  assert.equal(h.state.CurrentStep, 5)
  assert.equal(h.state.SearchMessage, '')
  assert.equal(h.state.SearchSaving, false)
})

test('search save creates only if lookup confirms no existing row and records the returned id', async () => {
  const h = setup({ profile: null, saved: { id: 'new-search' }, env: {
    searchForm: { min_intent_level: '4', max_age_hours: '48', active: false },
  } })
  await handler('saveSearchPreferences', h.env)()
  const payload = h.calls.find(([kind]) => kind === 'insert')[1]
  assert.equal(payload.source, 'pending')
  assert.equal(payload.min_intent_level, 4)
  assert.equal(payload.max_age_hours, 48)
  assert.equal(payload.active, false)
  assert.equal(h.env.searchProfileId.current, 'new-search')
  assert.equal(h.state.CurrentStep, 5)
})

test('search save reuses a row created since loading instead of inserting', async () => {
  const h = setup({ profile: { id: 'externally-created' } })
  await handler('saveSearchPreferences', h.env)()
  assert(h.calls.some(([kind]) => kind === 'update'))
  assert(!h.calls.some(([kind]) => kind === 'insert'))
})

test('missing previously-loaded search profile is an error, not permission to insert another', async () => {
  const h = setup({ profile: null })
  h.env.searchProfileId.current = 'missing-profile'
  await handler('saveSearchPreferences', h.env)()
  assert(!h.calls.some(([kind]) => kind === 'insert' || kind === 'update'))
  assert(h.state.SearchMessage.includes('could not be found'))
  assert.equal(h.state.CurrentStep, 3)
})

test('saving again after an insert updates the recorded row rather than inserting twice', async () => {
  let stored = null
  const h = setup({
    read: async () => ({ data: stored }),
    write: async () => { stored = { id: 'saved-search' }; return { data: stored } },
  })
  const save = handler('saveSearchPreferences', h.env)
  await save()
  await save()
  assert.equal(h.calls.filter(([kind]) => kind === 'insert').length, 1)
  assert.equal(h.calls.filter(([kind]) => kind === 'update').length, 1)
})

for (const env of [
  { services: [] },
  { services: [{ name: 'Shopify', active: false }] },
  { idealForm: { target_countries: [] } },
  { searchForm: { min_intent_level: 0, max_age_hours: 72 } },
  { searchForm: { min_intent_level: 6, max_age_hours: 72 } },
  { searchForm: { min_intent_level: 2.5, max_age_hours: 72 } },
  { searchForm: { min_intent_level: 3, max_age_hours: 'bad' } },
  { searchForm: { min_intent_level: 3, max_age_hours: -1 } },
]) {
  test('invalid search configuration prevents writes: ' + JSON.stringify(env), async () => {
    const h = setup({ env })
    await handler('saveSearchPreferences', h.env)()
    assert.equal(h.calls.length, 0)
    assert(h.state.SearchMessage)
    assert.equal(h.state.CurrentStep, 3)
  })
}

for (const env of [
  { searchLoading: true }, { searchLoadError: 'Read failed' },
  { servicesLoading: true }, { serviceMutationPending: true },
  { loading: true }, { profileLoadError: 'Read failed' },
]) {
  test('search save waits for successful stable loading: ' + JSON.stringify(env), async () => {
    const h = setup({ env })
    await handler('saveSearchPreferences', h.env)()
    assert.equal(h.calls.length, 0)
  })
}

for (const options of [
  { readError: { message: 'Read denied' } }, { readThrown: new Error('Read offline') },
  { writeError: { message: 'Write denied' } }, { writeThrown: new Error('Write offline') },
  { saved: null },
]) {
  test('search lookup/write failures or zero-row results retain settings and do not advance: ' + JSON.stringify(options), async () => {
    const h = setup(options)
    const form = h.env.searchForm
    await handler('saveSearchPreferences', h.env)()
    assert(h.state.SearchMessage)
    assert.equal(h.state.SearchForm, undefined)
    assert.equal(h.env.searchForm, form)
    assert.equal(h.state.CurrentStep, 3)
    assert.equal(h.state.SearchSaving, false)
    assert.equal(h.env.searchSavePending.current, false)
    if (options.readError || options.readThrown) assert(!h.calls.some(([kind]) => kind === 'insert' || kind === 'update'))
  })
}

test('double-click search save is locked before lookup finishes', async () => {
  let resolve
  const h = setup({ read: () => new Promise((done) => { resolve = done }) })
  const save = handler('saveSearchPreferences', h.env)
  const pending = save()
  await save()
  assert.equal(h.calls.filter(([kind]) => kind === 'maybeSingle').length, 1)
  resolve({ data: { id: 'search-existing' } })
  await pending
  assert.equal(h.calls.filter(([kind]) => kind === 'update').length, 1)
})

test('stale search lookup never writes to the previous workspace', async () => {
  let resolve
  const h = setup({ read: () => new Promise((done) => { resolve = done }) })
  const pending = handler('saveSearchPreferences', h.env)()
  h.env.searchLoadRequest.current += 1
  resolve({ data: { id: 'old-search' } })
  await pending
  assert(!h.calls.some(([kind]) => kind === 'update' || kind === 'insert'))
  assert.equal(h.state.CurrentStep, 3)
})

test('stale search write cannot advance a different workspace or replace its profile id', async () => {
  let resolve
  const h = setup({ write: () => new Promise((done) => { resolve = done }) })
  const pending = handler('saveSearchPreferences', h.env)()
  // Flush the lookup continuation so the write is pending.
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(typeof resolve, 'function')
  h.env.searchLoadRequest.current += 1
  h.env.searchProfileId.current = 'new-workspace-search'
  resolve({ data: { id: 'old-search' } })
  await pending
  assert.equal(h.state.CurrentStep, 3)
  assert.equal(h.env.searchProfileId.current, 'new-workspace-search')
  assert.equal(h.state.SearchForm, undefined)
})

test('portfolio loader reads all workspace projects in creation order without mutating them', async () => {
  const projects = [
    { id: 'project-1', project_name: 'Shopify store', active: true, services: ['Shopify'], technologies: ['Liquid'] },
    { id: 'project-2', project_name: 'Website redesign', active: false },
  ]
  const h = setup({ profile: projects })
  assert.equal(await handler('loadPortfolioItems', h.env)(), true)
  assert.deepEqual(h.state.PortfolioItems, projects)
  assert.deepEqual(h.calls, [
    ['from', 'portfolio_items'], ['select', '*'], ['eq', 'workspace_id', 'workspace-1'],
    ['order', 'created_at', { ascending: true }],
  ])
  assert.equal(h.state.PortfolioLoading, false)
  assert.equal(h.state.PortfolioMessage, '')
})

test('empty portfolio uses an empty array and never inserts records', async () => {
  for (const profile of [null, []]) {
    const h = setup({ profile })
    assert.equal(await handler('loadPortfolioItems', h.env)(), true)
    assert.deepEqual(h.state.PortfolioItems, [])
    assert.equal(h.state.PortfolioLoading, false)
    assert(!h.calls.some(([kind]) => kind === 'insert' || kind === 'update'))
  }
})

test('portfolio without workspace clears stale data and makes no request', async () => {
  const h = setup({ env: { workspaceId: null } })
  h.state.PortfolioItems = [{ id: 'old-workspace-project' }]
  assert.equal(await handler('loadPortfolioItems', h.env)(), false)
  assert.deepEqual(h.state.PortfolioItems, [])
  assert.equal(h.calls.length, 0)
  assert.equal(h.state.PortfolioLoading, false)
})

test('portfolio database and network failures clear loading and surface an error', async () => {
  for (const options of [{ readError: { message: 'Read denied' } }, { readThrown: new Error('Offline') }]) {
    const h = setup(options)
    assert.equal(await handler('loadPortfolioItems', h.env)(), false)
    assert(h.state.PortfolioMessage)
    assert.deepEqual(h.state.PortfolioItems, [])
    assert.equal(h.state.PortfolioLoading, false)
  }
})

test('successful portfolio retry clears the old error and restores projects', async () => {
  let fail = true
  const projects = [{ id: 'project-1', project_name: 'Recovered project' }]
  const h = setup({ read: async () => fail
    ? { error: { message: 'Offline' } }
    : { data: projects }
  })
  const load = handler('loadPortfolioItems', h.env)
  assert.equal(await load(), false)
  assert.equal(h.state.PortfolioMessage, 'Offline')
  fail = false
  assert.equal(await load(), true)
  assert.equal(h.state.PortfolioMessage, '')
  assert.deepEqual(h.state.PortfolioItems, projects)
})

test('stale portfolio results/errors cannot overwrite a newer workspace or its loading state', async () => {
  for (const response of [{ data: [{ id: 'old-project' }] }, { error: { message: 'Old error' } }]) {
    let resolve
    const h = setup({ read: () => new Promise((done) => { resolve = done }) })
    const pending = handler('loadPortfolioItems', h.env)()
    h.env.portfolioLoadRequest.current += 1
    h.state.PortfolioItems = [{ id: 'new-project' }]
    h.state.PortfolioMessage = 'New state'
    resolve(response)
    assert.equal(await pending, false)
    assert.deepEqual(h.state.PortfolioItems, [{ id: 'new-project' }])
    assert.equal(h.state.PortfolioMessage, 'New state')
    assert.equal(h.state.PortfolioLoading, true)
  }
})

test('portfolio parsers trim arrays, ignore empty entries, and split proof points by line', () => {
  assert.deepEqual(helpers.parseCommaList(' WordPress, wordpress, SEO, , '), ['WordPress', 'SEO'])
  assert.deepEqual(helpers.parseCommaList(), [])
  assert.deepEqual(helpers.parseLines(' First point\r\n\n Second point\n'), ['First point', 'Second point'])
})

test('new portfolio form clears the edit id, errors, and old fields', () => {
  const h = setup({ env: { editingPortfolioId: 'old-project' } })
  handler('openNewPortfolioForm', h.env)()
  assert.equal(h.state.EditingPortfolioId, null)
  assert.deepEqual(h.state.PortfolioForm, helpers.emptyPortfolioForm)
  assert.notEqual(h.state.PortfolioForm, helpers.emptyPortfolioForm)
  assert.equal(h.state.ShowPortfolioForm, true)
  assert.equal(h.state.PortfolioMessage, '')
})

test('edit portfolio prefills all fields and safely converts arrays into text', () => {
  const h = setup()
  handler('editPortfolioItem', h.env)({
    id: 'project-1', project_name: 'Site rebuild', client_name: 'Client', industry: 'Technology',
    services: ['Website', 'SEO'], technologies: ['WordPress', 'Elementor'],
    project_url: 'https://example.com', summary: 'Rebuild', proof_points: ['Faster site', 'Custom templates'], active: false,
  })
  assert.equal(h.state.EditingPortfolioId, 'project-1')
  assert.equal(h.state.PortfolioForm.services, 'Website, SEO')
  assert.equal(h.state.PortfolioForm.technologies, 'WordPress, Elementor')
  assert.equal(h.state.PortfolioForm.proof_points, 'Faster site\nCustom templates')
  assert.equal(h.state.PortfolioForm.active, undefined)
  assert.equal(h.state.ShowPortfolioForm, true)
  const empty = setup()
  handler('editPortfolioItem', empty.env)({ id: 'project-2', services: null, technologies: 'bad', proof_points: null })
  assert.deepEqual(empty.state.PortfolioForm, helpers.emptyPortfolioForm)
})

test('cancel portfolio form resets the draft and id but cannot cancel an in-flight write', () => {
  const h = setup({ env: { showPortfolioForm: true, editingPortfolioId: 'project-1' } })
  const cancel = handler('cancelPortfolioForm', h.env)
  h.env.portfolioMutationPendingRef.current = true
  cancel()
  assert.equal(h.state.ShowPortfolioForm, true)
  assert.equal(h.state.EditingPortfolioId, 'project-1')
  h.env.portfolioMutationPendingRef.current = false
  cancel()
  assert.equal(h.state.ShowPortfolioForm, false)
  assert.equal(h.state.EditingPortfolioId, null)
  assert.deepEqual(h.state.PortfolioForm, helpers.emptyPortfolioForm)
})

test('portfolio create inserts an active workspace project with parsed, trimmed fields', async () => {
  const h = setup({ env: { showPortfolioForm: true } })
  await handler('savePortfolioItem', h.env)()
  const payload = h.calls.find(([kind]) => kind === 'insert')[1]
  assert.equal(payload.workspace_id, 'workspace-1')
  assert.equal(payload.active, true)
  assert.equal(payload.project_name, 'Website rebuild')
  assert.equal(payload.client_name, 'Client')
  assert.deepEqual(payload.services, ['Website', 'SEO'])
  assert.deepEqual(payload.technologies, ['WordPress', 'Elementor'])
  assert.deepEqual(payload.proof_points, ['Faster website', 'Custom templates'])
  assert.equal(payload.project_url, 'https://example.com')
  assert(h.calls.some(([kind]) => kind === 'reloadPortfolio'))
  assert.equal(h.state.ShowPortfolioForm, false)
  assert.equal(h.state.EditingPortfolioId, null)
  assert.equal(h.state.PortfolioSaving, false)
})

test('portfolio update scopes both id/workspace and never changes active status', async () => {
  const h = setup({ env: { editingPortfolioId: 'project-1', showPortfolioForm: true } })
  await handler('savePortfolioItem', h.env)()
  const payload = h.calls.find(([kind]) => kind === 'update')[1]
  assert.equal(payload.active, undefined)
  assert.equal(payload.workspace_id, undefined)
  assert(h.calls.some(([kind, key, value]) => kind === 'eq' && key === 'id' && value === 'project-1'))
  assert(h.calls.some(([kind, key, value]) => kind === 'eq' && key === 'workspace_id' && value === 'workspace-1'))
  assert(!h.calls.some(([kind]) => kind === 'insert'))
  assert.equal(h.state.ShowPortfolioForm, false)
})

test('optional portfolio fields become null or empty arrays', async () => {
  const h = setup({ env: { portfolioForm: { ...helpers.emptyPortfolioForm, project_name: 'New project' } } })
  await handler('savePortfolioItem', h.env)()
  const payload = h.calls.find(([kind]) => kind === 'insert')[1]
  for (const field of ['client_name', 'industry', 'project_url', 'summary']) assert.equal(payload[field], null)
  for (const field of ['services', 'technologies', 'proof_points']) assert.deepEqual(payload[field], [])
})

test('blank project names and unsafe/invalid URLs block portfolio writes', async () => {
  for (const fields of [{ project_name: ' ' }, { project_url: 'not a URL' }, { project_url: 'javascript:alert(1)' }]) {
    const h = setup()
    Object.assign(h.env.portfolioForm, fields)
    await handler('savePortfolioItem', h.env)()
    assert.equal(h.calls.length, 0)
    assert(h.state.PortfolioMessage)
  }
})

for (const options of [
  { writeError: { message: 'Permission denied' } }, { writeThrown: new Error('Offline') }, { saved: null },
]) {
  test('failed/zero-row portfolio write preserves the draft and edit mode: ' + JSON.stringify(options), async () => {
    const h = setup({ ...options, env: { editingPortfolioId: 'project-1', showPortfolioForm: true } })
    const draft = h.state.PortfolioForm
    await handler('savePortfolioItem', h.env)()
    assert.equal(h.state.PortfolioForm, draft)
    assert.equal(h.state.EditingPortfolioId, 'project-1')
    assert.equal(h.state.ShowPortfolioForm, true)
    assert(h.state.PortfolioMessage)
    assert.equal(h.state.PortfolioSaving, false)
    assert.equal(h.env.portfolioMutationPendingRef.current, false)
    assert(!h.calls.some(([kind]) => kind === 'reloadPortfolio'))
  })
}

test('saved portfolio with failed refresh closes the form and reports partial success', async () => {
  const h = setup({ refreshed: false, env: { showPortfolioForm: true } })
  await handler('savePortfolioItem', h.env)()
  assert.equal(h.state.ShowPortfolioForm, false)
  assert(h.state.PortfolioMessage.includes('Project saved'))
  assert(h.state.PortfolioMessage.includes('could not be refreshed'))
})

test('portfolio toggle handles disable and reactivate with workspace/id scopes', async () => {
  for (const active of [true, false]) {
    const h = setup()
    await handler('togglePortfolioActive', h.env)({ id: 'project-1', active })
    const payload = h.calls.find(([kind]) => kind === 'update')[1]
    assert.equal(payload.active, !active)
    assert(!Number.isNaN(new Date(payload.updated_at).getTime()))
    assert(h.calls.some(([kind, key, value]) => kind === 'eq' && key === 'id' && value === 'project-1'))
    assert(h.calls.some(([kind, key, value]) => kind === 'eq' && key === 'workspace_id' && value === 'workspace-1'))
    assert(h.calls.some(([kind]) => kind === 'reloadPortfolio'))
    assert.equal(h.state.PortfolioTogglingId, null)
    assert.equal(h.env.portfolioMutationPendingRef.current, false)
  }
})

test('portfolio toggle failures release locks and never refresh a failed update', async () => {
  for (const options of [{ writeError: { message: 'Denied' } }, { writeThrown: new Error('Offline') }, { saved: null }]) {
    const h = setup(options)
    await handler('togglePortfolioActive', h.env)({ id: 'project-1', active: true })
    assert(h.state.PortfolioMessage)
    assert.equal(h.state.PortfolioTogglingId, null)
    assert.equal(h.env.portfolioMutationPendingRef.current, false)
    assert(!h.calls.some(([kind]) => kind === 'reloadPortfolio'))
  }
})

test('portfolio toggle refresh failure reports that status was already saved', async () => {
  const h = setup({ refreshed: false })
  await handler('togglePortfolioActive', h.env)({ id: 'project-1', active: true })
  assert(h.state.PortfolioMessage.includes('Project status updated'))
})

test('portfolio writes are immediately locked against double submits and concurrent toggles', async () => {
  let resolve
  const h = setup({ write: () => new Promise((done) => { resolve = done }) })
  const save = handler('savePortfolioItem', h.env)
  const pending = save()
  await save()
  await handler('togglePortfolioActive', h.env)({ id: 'project-1', active: true })
  assert.equal(h.calls.filter(([kind]) => kind === 'insert').length, 1)
  assert(!h.calls.some(([kind]) => kind === 'update'))
  resolve({ data: { id: 'new-project' } })
  await pending
})

test('form drafts and failed loaders block portfolio switching/toggling', async () => {
  const h = setup({ env: { showPortfolioForm: true } })
  handler('editPortfolioItem', h.env)({ id: 'another-project' })
  await handler('togglePortfolioActive', h.env)({ id: 'project-1', active: true })
  assert.equal(h.state.EditingPortfolioId, null)
  assert.equal(h.calls.length, 0)
  const failed = setup({ env: { portfolioLoadError: 'Read denied' } })
  handler('openNewPortfolioForm', failed.env)()
  await handler('savePortfolioItem', failed.env)()
  assert.equal(failed.state.ShowPortfolioForm, false)
  assert.equal(failed.calls.length, 0)
})

test('stale portfolio mutation cannot reset another workspace draft or reload old items', async () => {
  for (const name of ['savePortfolioItem', 'togglePortfolioActive']) {
    let resolve
    const h = setup({ write: () => new Promise((done) => { resolve = done }) })
    const pending = handler(name, h.env)({ id: 'project-1', active: true })
    h.env.profileLoadRequest.current += 1
    const draft = h.state.PortfolioForm
    resolve({ data: { id: 'old-project' } })
    await pending
    assert.equal(h.state.PortfolioForm, draft)
    assert(!h.calls.some(([kind]) => kind === 'reloadPortfolio'))
    assert.equal(h.env.portfolioMutationPendingRef.current, false)
  }
})

const completedWorkspace = {
  id: 'workspace-1', name: 'My workspace', owner_user_id: 'user-1',
  onboarding_completed: true, onboarding_completed_at: '2026-09-12T10:00:00.000Z',
}

test('completion updates only the owned workspace and hands confirmed data to the parent without reload', async () => {
  const h = setup({ saved: completedWorkspace })
  await handler('completeOnboarding', h.env)()
  const payload = h.calls.find(([kind]) => kind === 'update')[1]
  assert.equal(payload.onboarding_completed, true)
  assert(!Number.isNaN(new Date(payload.onboarding_completed_at).getTime()))
  assert(h.calls.some(([kind, table]) => kind === 'from' && table === 'workspaces'))
  assert(h.calls.some(([kind, key, value]) => kind === 'eq' && key === 'id' && value === 'workspace-1'))
  assert(h.calls.some(([kind, key, value]) => kind === 'eq' && key === 'owner_user_id' && value === 'user-1'))
  assert.deepEqual(h.calls.find(([kind]) => kind === 'onComplete')[1], completedWorkspace)
  assert(!h.calls.some(([kind]) => kind === 'reloadPage'))
  assert.equal(h.state.CompletingSetup, false)
  assert.equal(h.env.completionPendingRef.current, false)
})

test('completion with no parent callback falls back to reload after confirmed persistence', async () => {
  const h = setup({ saved: completedWorkspace, env: { onComplete: undefined } })
  await handler('completeOnboarding', h.env)()
  assert(h.calls.some(([kind]) => kind === 'reloadPage'))
})

test('completion requires both workspace and authenticated user', async () => {
  for (const env of [{ workspace: null }, { user: null }]) {
    const h = setup({ env })
    await handler('completeOnboarding', h.env)()
    assert.equal(h.calls.length, 0)
    assert(h.state.PortfolioMessage.includes('could not be found'))
  }
})

test('completion requires saved/cancelled portfolio drafts but not any portfolio records', async () => {
  const draft = setup({ env: { showPortfolioForm: true } })
  await handler('completeOnboarding', draft.env)()
  assert.equal(draft.calls.length, 0)
  assert(draft.state.PortfolioMessage.includes('save or cancel'))
  const optional = setup({ saved: completedWorkspace, profile: [] })
  await handler('completeOnboarding', optional.env)()
  assert(optional.calls.some(([kind]) => kind === 'onComplete'))
})

test('completion waits for ongoing loads/writes and prevents duplicate submissions immediately', async () => {
  for (const env of [
    { portfolioLoading: true }, { loading: true }, { profileLoadError: 'Read failed' },
    { portfolioMutationPendingRef: { current: true } },
  ]) {
    const h = setup({ env })
    await handler('completeOnboarding', h.env)()
    assert.equal(h.calls.length, 0)
  }
  let resolve
  const h = setup({ write: () => new Promise((done) => { resolve = done }) })
  const complete = handler('completeOnboarding', h.env)
  const pending = complete()
  await complete()
  await handler('savePortfolioItem', h.env)()
  await handler('togglePortfolioActive', h.env)({ id: 'project-1', active: true })
  handler('openNewPortfolioForm', h.env)()
  assert.equal(h.calls.filter(([kind]) => kind === 'update').length, 1)
  assert(!h.calls.some(([kind]) => kind === 'insert'))
  assert.equal(h.state.ShowPortfolioForm, false)
  resolve({ data: completedWorkspace })
  await pending
})

for (const options of [
  { writeError: { message: 'Permission denied' } }, { writeThrown: new Error('Offline') },
  { saved: null }, { saved: { ...completedWorkspace, onboarding_completed: false } },
  { saved: { ...completedWorkspace, id: 'wrong-workspace' } },
  { saved: { ...completedWorkspace, owner_user_id: 'wrong-user' } },
]) {
  test('failed or unconfirmed completion remains in onboarding and releases locks: ' + JSON.stringify(options), async () => {
    const h = setup(options)
    await handler('completeOnboarding', h.env)()
    assert(h.state.PortfolioMessage)
    assert(!h.calls.some(([kind]) => kind === 'onComplete' || kind === 'reloadPage'))
    assert.equal(h.state.CompletingSetup, false)
    assert.equal(h.env.completionPendingRef.current, false)
  })
}

test('async completion callback failures are caught and displayed', async () => {
  const h = setup({ saved: completedWorkspace, env: { onComplete: async () => { throw new Error('Parent update failed') } } })
  await handler('completeOnboarding', h.env)()
  assert.equal(h.state.PortfolioMessage, 'Parent update failed')
  assert.equal(h.state.CompletingSetup, false)
})

test('stale completion result cannot transition a new workspace or display an old error', async () => {
  for (const response of [{ data: completedWorkspace }, { error: { message: 'Old error' } }]) {
    let resolve
    const h = setup({ write: () => new Promise((done) => { resolve = done }) })
    const pending = handler('completeOnboarding', h.env)()
    h.env.profileLoadRequest.current += 1
    h.state.PortfolioMessage = 'New workspace state'
    resolve(response)
    await pending
    assert.equal(h.state.PortfolioMessage, 'New workspace state')
    assert(!h.calls.some(([kind]) => kind === 'onComplete' || kind === 'reloadPage'))
    assert.equal(h.env.completionPendingRef.current, false)
  }
})

test('App completion callback merges the confirmed workspace to open its dashboard without reviving a stale workspace', () => {
  const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8').replace(/\r\n/g, '\n')
  const marker = 'onComplete={'
  const start = app.indexOf(marker, app.indexOf('<Onboarding')) + marker.length
  const end = app.indexOf('\n        }}', start)
  assert(end > start)
  const callbackSource = app.slice(start, end) + '\n        }'
  for (const initial of [
    { ...completedWorkspace, onboarding_completed: false, custom_setting: 'keep' },
    null,
    { id: 'other-workspace', owner_user_id: 'user-1', onboarding_completed: false },
    { id: 'workspace-1', owner_user_id: 'other-user', onboarding_completed: false },
  ]) {
    let workspace = initial
    const callback = new Function('setWorkspace', 'return ' + callbackSource)(
      (updater) => { workspace = updater(workspace) }
    )
    callback(completedWorkspace)
    if (initial?.id === completedWorkspace.id && initial.owner_user_id === completedWorkspace.owner_user_id) {
      assert.equal(workspace.onboarding_completed, true)
      assert.equal(workspace.custom_setting, 'keep')
      assert.equal(workspace.onboarding_completed_at, completedWorkspace.onboarding_completed_at)
    } else {
      assert.equal(workspace, initial)
    }
  }
})
