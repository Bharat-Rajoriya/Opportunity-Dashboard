const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const source = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8').replace(/\r\n/g, '\n')

const loaderStart = source.indexOf('  const loadApprovedOutreach = useCallback(')
const loaderEnd = source.indexOf('  const submitReviewDecision =', loaderStart)
assert(loaderStart >= 0 && loaderEnd > loaderStart)

function setupLoader(rows = []) {
  const state = { outreach: [], loading: false, error: '' }
  const calls = []
  const request = { current: 0 }
  const env = {
    useCallback: (handler) => handler,
    approvedOutreachRequest: request,
    setApprovedOutreach(value) {
      state.outreach = typeof value === 'function' ? value(state.outreach) : value
    },
    setApprovedOutreachLoading(value) { state.loading = value },
    setApprovedOutreachError(value) { state.error = value },
    console: { error(...args) { calls.push(['error', ...args]) } },
    supabase: {
      from(table) {
        calls.push(['from', table])
        const filters = []
        const query = {
          select(fields) { calls.push(['select', fields]); return query },
          eq(column, value) {
            calls.push(['eq', column, value])
            filters.push((row) => row[column] === value)
            return query
          },
          in(column, values) {
            calls.push(['in', column, values])
            filters.push((row) => values.includes(row[column]))
            return query
          },
          order(column, options) { calls.push(['order', column, options]); return query },
          then(resolve, reject) {
            return Promise.resolve({
              data: rows.filter((row) => filters.every((filter) => filter(row))),
            }).then(resolve, reject)
          },
        }
        return query
      },
    },
  }

  const load = new Function(
    ...Object.keys(env),
    source.slice(loaderStart, loaderEnd) + 'return loadApprovedOutreach'
  )(...Object.values(env))

  return { load, state, calls }
}

test('approved outreach is workspace scoped and includes only approved drafted or edited messages', async () => {
  const base = { workspace_id: 'workspace-1', outreach_review_status: 'approved' }
  const h = setupLoader([
    { ...base, id: 'drafted', outreach_status: 'drafted' },
    { ...base, id: 'edited', outreach_status: 'edited' },
    { ...base, id: 'sent', outreach_status: 'sent' },
    { ...base, id: 'pending', outreach_status: 'drafted', outreach_review_status: 'pending_review' },
    { ...base, id: 'other-workspace', outreach_status: 'drafted', workspace_id: 'workspace-2' },
  ])

  await h.load('workspace-1')

  assert.deepEqual(h.state.outreach.map((lead) => lead.id), ['drafted', 'edited'])
  assert.deepEqual(h.calls.filter(([kind]) => kind === 'eq'), [
    ['eq', 'workspace_id', 'workspace-1'],
    ['eq', 'outreach_review_status', 'approved'],
  ])
  assert.deepEqual(h.calls.find(([kind]) => kind === 'in'), [
    'in', 'outreach_status', ['drafted', 'edited'],
  ])
  assert.equal(h.state.loading, false)
})

const actionStart = source.indexOf('  const copyApprovedMessage = async (')
const actionEnd = source.indexOf('  const loadOpportunityActivity =', actionStart)
assert(actionStart >= 0 && actionEnd > actionStart)

function setupSendAction(options = {}) {
  const lead = {
    id: 'lead-1',
    workspace_id: 'workspace-1',
    outreach_status: 'edited',
    outreach_review_status: 'approved',
    outreach_message: 'Approved message',
  }
  const state = {
    approved: [lead],
    opportunities: [lead],
    selected: lead,
    actionId: null,
    error: null,
  }
  const calls = []
  const env = {
    navigator: { clipboard: { writeText: async () => {} } },
    workspace: { id: 'workspace-1' },
    approvedOutreachLoading: false,
    approvedOutreachRequest: { current: 1 },
    sendActionPendingRef: { current: null },
    setCopiedOutreachId() {},
    setSendActionId(value) { state.actionId = value },
    setSendActionError(value) { state.error = value },
    setApprovedOutreach(value) { state.approved = value(state.approved) },
    setOpportunities(value) { state.opportunities = value(state.opportunities) },
    setSelectedOpportunity(value) { state.selected = value(state.selected) },
    setTimeout() {},
    console: { log(...args) { calls.push(['log', ...args]) }, error(...args) { calls.push(['error', ...args]) } },
    supabase: {
      from(table) {
        calls.push(['from', table])
        const query = {
          update(payload) { calls.push(['update', payload]); return query },
          eq(column, value) { calls.push(['eq', column, value]); return query },
          in(column, values) { calls.push(['in', column, values]); return query },
          select(fields) { calls.push(['select', fields]); return query },
          single() {
            return Promise.resolve(options.error
              ? { error: options.error }
              : {
                data: {
                  id: lead.id,
                  outreach_status: 'sent',
                  outreach_sent_at: '2026-10-14T10:00:00.000Z',
                },
              })
          },
        }
        return query
      },
    },
  }

  const actions = new Function(
    ...Object.keys(env),
    source.slice(actionStart, actionEnd) + 'return { markOutreachAsSent }'
  )(...Object.values(env))

  return { ...actions, lead, state, calls }
}

test('mark as sent is guarded by workspace, approval, and ready outreach statuses', async () => {
  const h = setupSendAction()
  await h.markOutreachAsSent(h.lead)

  const payload = h.calls.find(([kind]) => kind === 'update')[1]
  assert.equal(payload.outreach_status, 'sent')
  assert(!Number.isNaN(new Date(payload.outreach_sent_at).getTime()))
  assert.deepEqual(h.calls.filter(([kind]) => kind === 'eq'), [
    ['eq', 'id', 'lead-1'],
    ['eq', 'workspace_id', 'workspace-1'],
    ['eq', 'outreach_review_status', 'approved'],
  ])
  assert.deepEqual(h.calls.find(([kind]) => kind === 'in'), [
    'in', 'outreach_status', ['drafted', 'edited'],
  ])
  assert.deepEqual(h.state.approved, [])
  assert.equal(h.state.opportunities[0].outreach_status, 'sent')
  assert.equal(h.state.selected.outreach_status, 'sent')
  assert.equal(h.state.actionId, null)
})

test('mark as sent rejects a lead from another workspace before writing', async () => {
  const h = setupSendAction()
  await h.markOutreachAsSent({ ...h.lead, workspace_id: 'workspace-2' })

  assert(!h.calls.some(([kind]) => kind === 'update'))
  assert.match(h.state.error.message, /workspace/i)
})

test('failed send keeps approved outreach available for retry', async () => {
  const h = setupSendAction({ error: { message: 'Write denied' } })
  await h.markOutreachAsSent(h.lead)

  assert.equal(h.state.approved.length, 1)
  assert.equal(h.state.error.message, 'Write denied')
  assert.equal(h.state.actionId, null)
})
