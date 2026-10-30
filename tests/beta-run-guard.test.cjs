const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const edge = readFileSync(
  join(__dirname, '../supabase/functions/run-opportunity-engine/index.ts'),
  'utf8'
).replace(/\r\n/g, '\n')

const service = readFileSync(
  join(__dirname, '../src/services/opportunityEngine.js'),
  'utf8'
).replace(/\r\n/g, '\n')

test('opportunity engine blocks simultaneous workspace runs', () => {
  assert(edge.includes(".eq('run_status', 'running')"))
  assert(edge.includes("error: 'run_already_in_progress'"))
  assert(edge.includes('{ status: 409 }'))
})

test('manual opportunity search has a server-side ten minute cooldown', () => {
  assert(edge.includes('const manualCooldownMs = 10 * 60 * 1000'))
  assert(edge.includes("error: 'run_cooldown_active'"))
  assert(edge.includes('retry_after_seconds'))
  assert(edge.includes("'Retry-After'"))
  assert(edge.includes('status: 429'))
})

test('cooldown uses recent server run timestamps and is workspace scoped', () => {
  assert(edge.includes(".eq('workspace_id', workspaceId)"))
  assert(edge.includes('latestRun.run_finished_at'))
  assert(edge.includes('latestRun.run_started_at'))
  assert(edge.includes('latestRun.created_at'))
})

test('frontend translates engine guard responses into useful messages', () => {
  assert(service.includes("functionError?.error === 'run_cooldown_active'"))
  assert(service.includes("functionError?.error === 'run_already_in_progress'"))
  assert(service.includes('Try again in about'))
})
