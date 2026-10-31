const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')
const test = require('node:test')
const assert = require('node:assert/strict')

const configPromise = import(pathToFileURL(join(__dirname, '../src/config/discoverySources.js')).href)
const onboard = readFileSync(join(__dirname, '../src/components/Onboarding.jsx'), 'utf8')
const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8')
const service = readFileSync(join(__dirname, '../src/services/searchProfiles.js'), 'utf8')

test('new onboarding defaults to both production-enabled sources', async () => {
  const { defaultDiscoverySources } = await configPromise
  assert.deepEqual(defaultDiscoverySources(true), ['google', 'freelancer'])
  assert.deepEqual(defaultDiscoverySources(false), ['google'])
})

test('onboarding source controls keep explicitly selected options and ignore unavailable sources', async () => {
  const { toggleOnboardingSource } = await configPromise
  assert.deepEqual(toggleOnboardingSource(['google', 'freelancer'], 'freelancer', false, true), ['google'])
  assert.deepEqual(toggleOnboardingSource(['google'], 'freelancer', true, true), ['google', 'freelancer'])
  assert.deepEqual(toggleOnboardingSource(['google'], 'freelancer', true, false), ['google'])
  assert.deepEqual(toggleOnboardingSource(['google'], 'google', false, false), [])
})

test('recovery suggestion is limited to zero-result Google-only workspaces when direct source is available', async () => {
  const { shouldSuggestFreelancer } = await configPromise
  const base = { freelancerAvailable: true, enabledSources: ['google'], opportunityCount: 0, loading: false }
  assert.equal(shouldSuggestFreelancer(base), true)
  for (const overrides of [
    { freelancerAvailable: false },
    { enabledSources: ['google', 'freelancer'] },
    { enabledSources: ['freelancer'] },
    { opportunityCount: 1 },
    { loading: true },
  ]) assert.equal(shouldSuggestFreelancer({ ...base, ...overrides }), false)
})

test('onboarding saves source choices and forbids an impossible fifth intent level', () => {
  assert(onboard.includes('enabled_sources: onboardingSources'))
  assert(onboard.includes('defaultDiscoverySources(FREELANCER_PRODUCTION_ENABLED)'))
  assert(onboard.includes('Select at least one discovery source'))
  assert(onboard.includes('minIntentLevel > 4'))
  assert(!onboard.includes('<option value={5}>5 — Very strong / urgent intent</option>'))
  assert(app.includes('intentLevel > 4'))
  assert(!app.includes('<option value={5}>5 — Immediate requirement</option>'))
})

test('dashboard offers an explicit opt-in instead of silently changing existing sources', () => {
  assert(app.includes('shouldSuggestFreelancer({'))
  assert(app.includes('handleEnableFreelancerDiscovery'))
  assert(app.includes('Enable Freelancer Projects'))
  assert(app.includes('sourceEnableError'))
})

test('source enablement writes only the workspace-scoped source list', async () => {
  const start = service.indexOf('export async function enableFreelancerDiscovery(')
  assert(start >= 0)
  const funcSource = service.slice(start).replace('export async function', 'async function')
  const writes = []
  const reads = []
  const record = { id: 'profile-1', workspace_id: 'workspace-1', enabled_sources: ['google'] }
  const supabase = {
    from(table) {
      assert.equal(table, 'search_profiles')
      const filters = []
      let pendingUpdate = null
      return {
        select(fields) { this.fields = fields; return this },
        eq(key, value) { filters.push([key, value]); return this },
        update(payload) { pendingUpdate = payload; return this },
        single() {
          assert.deepEqual(filters, [['id', 'profile-1'], ['workspace_id', 'workspace-1']])
          if (!pendingUpdate) {
            reads.push(this.fields)
            return Promise.resolve({ data: record, error: null })
          }
          writes.push(pendingUpdate)
          return Promise.resolve({ data: { ...record, ...pendingUpdate }, error: null })
        },
      }
    },
  }
  const normalizeSourceKeys = (items) => [...new Set(items)].filter(Boolean)
  const fetchSearchProfileById = () => { throw new Error('Unexpected duplicate read') }
  const factory = new Function('supabase', 'normalizeSourceKeys', 'fetchSearchProfileById', 'SEARCH_PROFILE_FIELDS',
    funcSource + '\nreturn enableFreelancerDiscovery')
  const enable = factory(supabase, normalizeSourceKeys, fetchSearchProfileById, 'id,workspace_id,enabled_sources')
  const result = await enable({ workspaceId: 'workspace-1', profileId: 'profile-1' })
  assert.deepEqual(result.enabled_sources, ['google', 'freelancer'])
  assert.equal(reads.length, 1)
  assert.equal(writes.length, 1)
  assert.deepEqual(Object.keys(writes[0]).sort(), ['enabled_sources', 'updated_at'])
  assert.equal(typeof writes[0].updated_at, 'string')
})

test('source enablement validates workspace and profile identifiers before database access', () => {
  assert(service.includes('if (!profileId || !workspaceId)'))
  assert(service.includes(".eq('id', profileId)"))
  assert(service.includes(".eq('workspace_id', workspaceId)"))
})
