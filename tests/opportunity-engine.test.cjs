const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const source = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8').replace(/\r\n/g, '\n')
const start = source.indexOf('  const handleFindOpportunities = async () => {')
const end = source.indexOf('  const refreshDashboard =', start)
assert(start >= 0 && end > start)

function setup(options = {}) {
  const state = { running: false, message: 'old success', error: 'old error', engineRun: null }
  const calls = [] 
  const request = { current: 0 }
  const pending = { current: null }
  const settingsPending = { current: false }
  const env = {
    workspace: options.workspace === undefined ? { id: 'workspace-1' } : options.workspace,
    searchRunRequest: request,
    searchRunPendingRef: pending,
    searchSettingsSavePendingRef: settingsPending,
    setSearchRunning(value) { state.running = value },
    setSearchMessage(value) { state.message = value },
    setSearchError(value) { state.error = value },
    setEngineRun(value) { state.engineRun = value },
    getLatestEngineRun(workspaceId) {
      calls.push(['getLatestEngineRun', workspaceId])
      if (options.latestRunThrow) throw options.latestRunThrow
      return Promise.resolve(options.previousRun === undefined ? { id: 'previous-run' } : options.previousRun)
    },
    waitForEngineRun(settings) {
      calls.push(['waitForEngineRun', settings])
      if (options.waitPromise) return options.waitPromise()
      if (options.waitThrow) throw options.waitThrow
      return Promise.resolve(options.completedRun === undefined
        ? {
          id: 'completed-run', run_status: 'completed',
          opportunities_processed: 2, outreach_drafted: 1,
        }
        : options.completedRun)
    },
    fetchOpportunities(workspaceId) {
      calls.push(['fetchOpportunities', workspaceId])
      return Promise.resolve()
    },
    loadReviewQueue(workspaceId) {
      calls.push(['loadReviewQueue', workspaceId])
      return Promise.resolve()
    },
    loadApprovedOutreach(workspaceId) {
      calls.push(['loadApprovedOutreach', workspaceId])
      return Promise.resolve()
    },
    console: {
      log(...args) { calls.push(['log', ...args]) },
      error(...args) { calls.push(['errorLog', ...args]) },
    },
    supabase: {
      auth: {
        getSession() {
          calls.push(['getSession'])
          if (options.sessionPromise) return options.sessionPromise()
          if (options.sessionThrow) throw options.sessionThrow
          return Promise.resolve({
            data: { session: options.session === undefined ? { access_token: 'session-token' } : options.session },
            error: options.sessionError,
          })
        },
      },
    },
    triggerOpportunityEngine(workspaceId) {
      calls.push(['triggerOpportunityEngine', workspaceId])
      if (options.invokePromise) return options.invokePromise()
      if (options.invokeThrow) throw options.invokeThrow
      if (options.invokeError) throw options.invokeError

      const data =
        options.data === undefined
          ? { success: true, message: 'Engine queued.' }
          : options.data

      if (!data?.success) {
        throw new Error(
          data?.message ||
            data?.error ||
            'Unable to start opportunity search.'
        )
      }

      return Promise.resolve(data)
    },
  }
  const handler = new Function(...Object.keys(env), source.slice(start, end) + 'return handleFindOpportunities')(
    ...Object.values(env)
  )
  return { handler, state, calls, request, pending }
}

test('starts the opportunity engine for the current workspace through the authenticated client', async () => {
  const h = setup()
  await h.handler()
  assert.deepEqual(
    h.calls.find(([kind]) => kind === 'triggerOpportunityEngine'),
    ['triggerOpportunityEngine', 'workspace-1']
  )
  assert(
    h.calls.findIndex(([kind]) => kind === 'getSession') <
      h.calls.findIndex(([kind]) => kind === 'triggerOpportunityEngine')
  )
  assert.equal(h.state.message, 'Search complete. 2 opportunities processed and 1 outreach draft generated.')
  assert.equal(h.state.error, '')
  assert.equal(h.state.running, false)
  assert.equal(h.pending.current, null)
  assert(h.calls.some(([kind, label]) => kind === 'log' && label === 'Opportunity Engine accepted:'))
  assert.deepEqual(h.calls.find(([kind]) => kind === 'waitForEngineRun'), [
    'waitForEngineRun', {
      workspaceId: 'workspace-1',
      previousRunId: 'previous-run',
      requestId: 1,
    },
  ])
  for (const kind of ['fetchOpportunities', 'loadReviewQueue', 'loadApprovedOutreach']) {
    assert.deepEqual(h.calls.find(([callKind]) => callKind === kind), [kind, 'workspace-1'])
  }
})

test('reports a valid completed run with no processed opportunities', async () => {
  const h = setup({
    data: { success: true },
    completedRun: { id: 'completed-run', run_status: 'completed' },
  })
  await h.handler()
  assert.equal(h.state.message, 'Search complete. No new opportunities were processed during this run.')
})

test('missing workspace reports an error without checking the session or invoking the function', async () => {
  const h = setup({ workspace: null })
  await h.handler()
  assert.equal(h.state.error, 'Workspace not found. Please refresh and try again.')
  assert.equal(h.state.message, '')
  assert.equal(h.calls.length, 0)
})

test('session errors and expired sessions never invoke the edge function', async () => {
  for (const options of [
    { sessionError: { message: 'Session lookup failed' } },
    { session: null },
    { session: {} },
    { sessionThrow: new Error('Offline') },
  ]) {
    const h = setup(options)
    await h.handler()
    assert(!h.calls.some(([kind]) => kind === 'triggerOpportunityEngine'))
    assert(h.state.error)
    assert.equal(h.state.message, '')
    assert.equal(h.state.running, false)
    assert.equal(h.pending.current, null)
  }
})

test('function transport errors and unsuccessful responses surface their useful message', async () => {
  for (const [options, expected] of [
    [{ invokeError: { message: 'Function unavailable' } }, 'Function unavailable'],
    [{ invokeThrow: new Error('Network offline') }, 'Network offline'],
    [{ data: { success: false, message: 'Search profile inactive' } }, 'Search profile inactive'],
    [{ data: { success: false, error: 'No search queries' } }, 'No search queries'],
    [{ data: null }, 'Unable to start opportunity search.'],
  ]) {
    const h = setup(options)
    await h.handler()
    assert.equal(h.state.error, expected)
    assert.equal(h.state.message, '')
    assert.equal(h.state.running, false)
    assert.equal(h.pending.current, null)
  }
})

test('duplicate clicks are locked immediately while the function is running', async () => {
  let resolveInvoke
  const h = setup({ invokePromise: () => new Promise((resolve) => { resolveInvoke = resolve }) })
  const first = h.handler()
  await new Promise((resolve) => setImmediate(resolve))
  const second = h.handler()
  await second
  assert.equal(h.calls.filter(([kind]) => kind === 'getSession').length, 1)
  assert.equal(h.calls.filter(([kind]) => kind === 'triggerOpportunityEngine').length, 1)
  assert.equal(h.state.running, true)
  resolveInvoke({ data: { success: true } })
  await first
  assert.equal(h.state.running, false)
})

test('workspace change after session lookup prevents invoking for the stale workspace', async () => {
  let resolveSession
  const h = setup({ sessionPromise: () => new Promise((resolve) => { resolveSession = resolve }) })
  const run = h.handler()
  h.request.current += 1
  h.pending.current = null
  h.state.running = false
  h.state.message = 'new workspace state'
  resolveSession({ data: { session: { access_token: 'token' } } })
  await run
  assert(!h.calls.some(([kind]) => kind === 'triggerOpportunityEngine'))
  assert.equal(h.state.message, 'new workspace state')
  assert.equal(h.state.running, false)
})

test('late edge-function result cannot update a newer workspace state', async () => {
  let resolveInvoke
  const h = setup({ invokePromise: () => new Promise((resolve) => { resolveInvoke = resolve }) })
  const run = h.handler()
  await new Promise((resolve) => setImmediate(resolve))
  h.request.current += 1
  h.pending.current = null
  h.state.running = false
  h.state.message = 'new workspace state'
  h.state.error = ''
  resolveInvoke({ data: { success: true, message: 'Old success' } })
  await run
  assert.equal(h.state.message, 'new workspace state')
  assert.equal(h.state.error, '')
  assert.equal(h.state.running, false)
})

test('dashboard exposes accessible success/error feedback and responsive engine styles', () => {
  const dashboard = source.slice(source.indexOf('className="engine-action-card"'), source.indexOf('{/* Stats */}'))
  assert(dashboard.includes('handleFindOpportunities'))
  assert(dashboard.includes('Search Running...'))
  assert(dashboard.includes('role="status"'))
  assert(dashboard.includes('role="alert"'))

  const css = readFileSync(join(__dirname, '../src/App.css'), 'utf8')
  for (const selector of [
    '.engine-action-card', '.engine-eyebrow', '.find-opportunities-btn',
    '.engine-success-message', '.engine-error-message', '@media (max-width: 640px)',
  ]) assert(css.includes(selector))
})
