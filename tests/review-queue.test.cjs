const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const source = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8').replace(/\r\n/g, '\n')
const start = source.indexOf('  const loadReviewQueue = useCallback(')
const end = source.indexOf('  const loadOpportunityActivity =', start)
assert(start >= 0 && end > start)

function setup(options = {}) {
  const state = { queue: [], loading: false, error: '' }
  const calls = []
  const request = { current: 0 }
  const rows = options.rows ?? []
  const supabase = {
    from(table) {
      calls.push(['from', table])
      const filters = []
      const ordering = []
      const query = {
        select(columns) { calls.push(['select', columns]); return query },
        eq(column, value) {
          calls.push(['eq', column, value])
          filters.push([column, value, true])
          return query
        },
        neq(column, value) {
          calls.push(['neq', column, value])
          filters.push([column, value, false])
          return query
        },
        order(column, settings) {
          calls.push(['order', column, settings])
          ordering.push([column, settings])
          return query
        },
        then(resolve, reject) {
          const result = options.query
            ? options.query()
            : Promise.resolve(options.error
              ? { error: options.error }
              : {
                data: rows.filter((row) => filters.every(([key, value, equal]) =>
                  equal ? row[key] === value : row[key] !== value
                ))
                  .sort((left, right) => {
                    for (const [key, settings] of ordering) {
                      const comparison = key === 'total_score'
                        ? Number(right[key]) - Number(left[key])
                        : String(right[key]).localeCompare(String(left[key]))
                      if (comparison !== 0) return settings.ascending ? -comparison : comparison
                    }
                    return 0
                  }),
              })
          if (result) return result.then(resolve, reject)
        },
      }
      return query
    },
  }
  const env = {
    useCallback: (handler) => handler,
    reviewQueueRequest: request,
    setReviewQueue(value) { state.queue = value },
    setReviewQueueLoading(value) { state.loading = value },
    setReviewQueueError(value) { state.error = value },
    supabase,
    console: { log(...args) { calls.push(['log', ...args]) }, error(...args) { calls.push(['error', ...args]) } },
  }
  const load = new Function(...Object.keys(env), source.slice(start, end) + 'return loadReviewQueue')(
    ...Object.values(env)
  )
  return { load, state, calls, request }
}

test('review queue returns only generated outreach pending review, highest scores then newest pitches', async () => {
  const base = { workspace_id: 'workspace-1', outreach_status: 'drafted', outreach_review_status: 'pending_review' }
  const h = setup({ rows: [
    { ...base, id: 'older', total_score: 84, outreach_generated_at: '2026-09-16T10:00:00Z' },
    { ...base, id: 'newer', total_score: 84, outreach_generated_at: '2026-09-17T10:00:00Z' },
    { ...base, id: 'lower', total_score: 70, outreach_generated_at: '2026-09-17T11:00:00Z' },
    { ...base, id: 'edited', outreach_status: 'edited', total_score: 65 },
    { ...base, id: 'research', recommended_action: 'research', outreach_status: 'not_generated' },
    { ...base, id: 'approved', outreach_review_status: 'approved' },
    { ...base, id: 'other-workspace', workspace_id: 'workspace-2' },
  ] })
  await h.load('workspace-1')
  assert.deepEqual(h.state.queue.map((row) => row.id), ['newer', 'older', 'lower', 'edited'])
  assert.deepEqual(h.calls.filter(([kind]) => kind === 'eq'), [
    ['eq', 'workspace_id', 'workspace-1'],
    ['eq', 'outreach_review_status', 'pending_review'],
  ])
  assert.deepEqual(h.calls.filter(([kind]) => kind === 'neq'), [
    ['neq', 'outreach_status', 'not_generated'],
  ])
  assert.deepEqual(h.calls.filter(([kind]) => kind === 'order'), [
    ['order', 'total_score', { ascending: false }],
    ['order', 'outreach_generated_at', { ascending: false }],
  ])
  const projection = h.calls.find(([kind]) => kind === 'select')[1]
  for (const field of ['outreach_message', 'why_relevant', 'source_url', 'recommended_action']) {
    assert(projection.includes(field))
  }
  assert.equal(h.state.loading, false)
  assert.equal(h.state.error, '')
})

test('missing workspace clears the queue without querying Supabase', async () => {
  const h = setup()
  h.state.queue = [{ id: 'stale' }]
  await h.load(null)
  assert.deepEqual(h.state.queue, [])
  assert.equal(h.state.loading, false)
  assert(!h.calls.some(([kind]) => kind === 'from'))
})

test('database errors show a retryable error rather than the empty state', async () => {
  const h = setup({ error: { message: 'Read denied' } })
  await h.load('workspace-1')
  assert.equal(h.state.error, 'Read denied')
  assert.deepEqual(h.state.queue, [])
  assert.equal(h.state.loading, false)
})

test('late responses cannot overwrite the review queue for a newer workspace', async () => {
  let resolveOld
  const h = setup({ query: () => new Promise((resolve) => { resolveOld = resolve }) })
  const pending = h.load('workspace-1')
  await Promise.resolve()
  h.request.current += 1
  h.state.queue = [{ id: 'new-workspace' }]
  h.state.loading = true
  resolveOld({ data: [{ id: 'old-workspace' }] })
  await pending
  assert.deepEqual(h.state.queue, [{ id: 'new-workspace' }])
  assert.equal(h.state.loading, true)
})

const actionStart = source.indexOf('  const addApprovedOutreach = (')
const actionEnd = source.indexOf('  const loadOpportunityActivity =', actionStart)
assert(actionStart >= 0 && actionEnd > actionStart)

const sampleLead = {
  id: 'lead-1', workspace_id: 'workspace-1', outreach_status: 'drafted',
  outreach_review_status: 'pending_review', outreach_message: '  AI draft  ',
  outreach_subject: '  Original subject  ',
}

function setupActions(options = {}) {
  const state = {
    queue: [sampleLead, { ...sampleLead, id: 'lead-2' }],
    opportunities: [sampleLead],
    selected: sampleLead,
    editingId: options.editingId ?? null,
    editedMessage: options.editedMessage ?? '',
    editedSubject: options.editedSubject ?? '',
    actionId: null,
    actionError: null,
    rejectingOpportunity: options.rejectingOpportunity ?? null,
    rejectionReason: options.rejectionReason ?? '',
    rejectionNote: options.rejectionNote ?? '',
    approvedOutreach: [],
  }
  const calls = []
  const request = { current: 1 }
  const pending = { current: null }
  let resolveWrite
  const env = {
    workspace: { id: 'workspace-1' },
    reviewQueueRequest: request,
    reviewActionPendingRef: pending,
    reviewQueueLoading: false,
    editingId: options.editingId ?? null,
    editedMessage: options.editedMessage ?? '',
    editedSubject: options.editedSubject ?? '',
    rejectingOpportunity: options.rejectingOpportunity ?? null,
    rejectionReason: options.rejectionReason ?? '',
    rejectionNote: options.rejectionNote ?? '',
    console: { log(...args) { calls.push(['log', ...args]) }, error(...args) { calls.push(['error', ...args]) } },
    setReviewQueue(value) { state.queue = typeof value === 'function' ? value(state.queue) : value },
    setReviewActionId(value) { state.actionId = value },
    setReviewActionError(value) { state.actionError = value },
    setEditingId(value) { state.editingId = value },
    setEditedMessage(value) { state.editedMessage = value },
    setEditedSubject(value) { state.editedSubject = value },
    setRejectingOpportunity(value) { state.rejectingOpportunity = value },
    setRejectionReason(value) { state.rejectionReason = value },
    setRejectionNote(value) { state.rejectionNote = value },
    setApprovedOutreach(value) {
      state.approvedOutreach = typeof value === 'function'
        ? value(state.approvedOutreach)
        : value
    },
    setOpportunities(value) { state.opportunities = value(state.opportunities) },
    setSelectedOpportunity(value) { state.selected = value(state.selected) },
    supabase: {
      from(table) {
        calls.push(['from', table])
        const query = {
          update(payload) { calls.push(['update', payload]); return query },
          eq(column, value) { calls.push(['eq', column, value]); return query },
          neq(column, value) { calls.push(['neq', column, value]); return query },
          select(fields) { calls.push(['select', fields]); return query },
          single() {
            calls.push(['single'])
            if (options.waitForWrite) return new Promise((resolve) => { resolveWrite = resolve })
            if (options.throwError) throw options.throwError
            return Promise.resolve(options.error
              ? { error: options.error }
              : { data: options.row === undefined ? { id: sampleLead.id } : options.row })
          },
        }
        return query
      },
    },
  }
  const actions = new Function(...Object.keys(env), source.slice(actionStart, actionEnd) +
    'return { submitReviewDecision, approveOpportunity, startEditing, cancelEditing, saveEditedOpportunity, startRejecting, cancelRejecting, rejectOpportunity }'
  )(...Object.values(env))
  return { ...actions, state, calls, request, pending, resolveWrite: (value) => resolveWrite(value) }
}

test('Approve changes only the review decision, retains drafted status, and removes the card', async () => {
  const h = setupActions()
  await h.approveOpportunity(sampleLead)
  const payload = h.calls.find(([kind]) => kind === 'update')[1]
  assert.equal(payload.outreach_review_status, 'approved')
  assert.equal(payload.outreach_status, undefined)
  assert(!Number.isNaN(new Date(payload.outreach_reviewed_at).getTime()))
  assert.deepEqual(h.calls.filter(([kind]) => kind === 'eq'), [
    ['eq', 'id', 'lead-1'], ['eq', 'workspace_id', 'workspace-1'],
    ['eq', 'outreach_review_status', 'pending_review'],
  ])
  assert.deepEqual(h.calls.filter(([kind]) => kind === 'neq'), [
    ['neq', 'outreach_status', 'not_generated'],
  ])
  assert.deepEqual(h.state.queue.map((lead) => lead.id), ['lead-2'])
  assert.deepEqual(h.state.approvedOutreach.map((lead) => lead.id), ['lead-1'])
  assert.equal(h.state.actionId, null)
})

test('Edit prefills the message and subject, then Save & Approve records human edits', async () => {
  const prefill = setupActions()
  prefill.startEditing(sampleLead)
  assert.equal(prefill.state.editingId, sampleLead.id)
  assert.equal(prefill.state.editedMessage, sampleLead.outreach_message)
  assert.equal(prefill.state.editedSubject, sampleLead.outreach_subject)

  const h = setupActions({ editingId: sampleLead.id, editedMessage: '  My rewritten pitch  ', editedSubject: '  New subject  ' })
  await h.saveEditedOpportunity(sampleLead)
  const payload = h.calls.find(([kind]) => kind === 'update')[1]
  assert.equal(payload.outreach_message, 'My rewritten pitch')
  assert.equal(payload.outreach_subject, 'New subject')
  assert.equal(payload.outreach_status, 'edited')
  assert.equal(payload.outreach_review_status, 'approved')
  assert.deepEqual(h.state.queue.map((lead) => lead.id), ['lead-2'])
  assert.equal(h.state.opportunities[0].outreach_message, 'My rewritten pitch')
  assert.equal(h.state.selected.outreach_status, 'edited')
  assert.equal(h.state.approvedOutreach[0].outreach_message, 'My rewritten pitch')
  assert.equal(h.state.editingId, null)
  assert.equal(h.state.editedMessage, '')
  assert.equal(h.state.editedSubject, '')
})

test('editing a message without a subject never writes an invented subject', async () => {
  const h = setupActions({ editingId: sampleLead.id, editedMessage: 'Rewritten', editedSubject: 'Unused' })
  await h.saveEditedOpportunity({ ...sampleLead, outreach_subject: null })
  assert.equal(h.calls.find(([kind]) => kind === 'update')[1].outreach_subject, undefined)
})

test('empty edited message is rejected without a database write or losing the draft', async () => {
  const h = setupActions({ editingId: sampleLead.id, editedMessage: '   ' })
  await h.saveEditedOpportunity(sampleLead)
  assert(!h.calls.some(([kind]) => kind === 'update'))
  assert.equal(h.state.editingId, sampleLead.id)
  assert.equal(h.state.actionError.message, 'Outreach message cannot be empty.')
  assert.equal(h.state.queue.length, 2)
})

test('Reject modal opens with a clean form and cancellation makes no write', () => {
  const h = setupActions({
    rejectingOpportunity: { id: 'stale' },
    rejectionReason: 'bad_draft',
    rejectionNote: 'stale note',
  })
  h.startRejecting(sampleLead)
  assert.equal(h.state.rejectingOpportunity, sampleLead)
  assert.equal(h.state.rejectionReason, '')
  assert.equal(h.state.rejectionNote, '')

  h.cancelRejecting()
  assert.equal(h.state.rejectingOpportunity, null)
  assert(!h.calls.some(([kind]) => kind === 'update'))
})

test('Reject stores the selected reason and optional note, then removes the card', async () => {
  const h = setupActions({
    rejectingOpportunity: sampleLead,
    rejectionReason: 'poor_lead_quality',
    rejectionNote: '  Missing buying intent  ',
  })
  await h.rejectOpportunity()
  const payload = h.calls.find(([kind]) => kind === 'update')[1]
  assert.equal(payload.outreach_review_status, 'rejected')
  assert.equal(payload.outreach_status, undefined)
  assert.equal(payload.outreach_rejection_reason, 'poor_lead_quality')
  assert.equal(payload.outreach_review_note, 'Missing buying intent')
  assert.deepEqual(h.state.queue.map((lead) => lead.id), ['lead-2'])
  assert.equal(h.state.rejectingOpportunity, null)
  assert.equal(h.state.rejectionReason, '')
  assert.equal(h.state.rejectionNote, '')
})

test('Reject requires a selected reason and converts a blank note to null', async () => {
  const missingReason = setupActions({ rejectingOpportunity: sampleLead })
  await missingReason.rejectOpportunity()
  assert(!missingReason.calls.some(([kind]) => kind === 'update'))

  const h = setupActions({
    rejectingOpportunity: sampleLead,
    rejectionReason: 'other',
    rejectionNote: '   ',
  })
  await h.rejectOpportunity()
  assert.equal(h.calls.find(([kind]) => kind === 'update')[1].outreach_review_note, null)
})

test('failed review writes leave the card and edited draft available for retry', async () => {
  for (const options of [
    { error: { message: 'Permission denied' } },
    { throwError: new Error('Offline') },
    { row: null },
  ]) {
    const h = setupActions({ ...options, editingId: sampleLead.id, editedMessage: 'My rewrite' })
    await h.saveEditedOpportunity(sampleLead)
    assert.equal(h.state.queue.length, 2)
    assert(h.state.actionError.message)
    assert.equal(h.state.actionError.id, sampleLead.id)
    assert.equal(h.state.actionId, null)
    assert.equal(h.state.editedMessage, 'My rewrite')
    assert.equal(h.pending.current, null)
  }
})

test('review writes reject a mismatched workspace before touching Supabase', async () => {
  const h = setupActions()
  await h.approveOpportunity({ ...sampleLead, workspace_id: 'workspace-2' })
  assert.equal(h.calls.length, 0)
  assert(h.state.actionError.message.includes('workspace'))
})

test('rapid repeated decisions are locked while a write is pending', async () => {
  let resolveWrite
  const h = setupActions({ waitForWrite: true })
  const pending = h.approveOpportunity(sampleLead)
  await h.approveOpportunity(sampleLead)
  await h.rejectOpportunity(sampleLead)
  assert.equal(h.calls.filter(([kind]) => kind === 'update').length, 1)
  resolveWrite = h.resolveWrite
  resolveWrite({ data: { id: sampleLead.id } })
  await pending
  assert.equal(h.pending.current, null)
})

test('late review results cannot remove a new workspace queue or reset its action', async () => {
  const h = setupActions({ waitForWrite: true })
  const pending = h.approveOpportunity(sampleLead)
  h.request.current += 1
  h.state.queue = [{ id: 'new-lead' }]
  h.resolveWrite({ data: { id: sampleLead.id } })
  await pending
  assert.deepEqual(h.state.queue, [{ id: 'new-lead' }])
})

test('review cards expose all three actions and the inline editor', () => {
  const card = source.slice(source.indexOf('<h2 className="text-xl font-semibold">Review Queue</h2>'),
    source.indexOf('{/* Opportunities */}'))
  for (const label of ['Approve', 'Edit', 'Reject', 'Save & Approve', 'Cancel']) {
    assert(card.includes(label))
  }
  assert(card.includes('reviewActionError?.id === lead.id'))
  for (const label of ['Not relevant', 'Rate too low', 'Poor lead quality', 'Wrong contact', 'Bad draft', 'Other']) {
    assert(source.includes(label))
  }
  assert(card.includes('Reject Outreach'))
  assert(source.includes('outreach_review_note'))
})
