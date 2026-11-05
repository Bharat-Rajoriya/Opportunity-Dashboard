const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const moduleSource = read('src/services/sourceReliability.js')
const loaded = import('data:text/javascript;base64,' + Buffer.from(moduleSource).toString('base64'))
const failed = (category, executionId = '123') => ({ status: 'failed', category, executionId, startedAt: '2026-11-05T12:00:00Z', failedStep: '01 - Run Opportunity Collector' })

test('rate limits do not imply quota exhaustion or allow automatic retries', async () => {
  const { getSourceRecoveryGuidance } = await loaded
  const recommendation = getSourceRecoveryGuidance(failed('rate_limit'))
  assert.match(recommendation.action, /cooldown/i)
  assert.match(recommendation.retry, /429 does not prove monthly quota exhaustion/i)
  assert.equal(recommendation.safeToAutoRetry, false)
})

test('explicit quota, authentication and network failures have distinct actions', async () => {
  const { getSourceRecoveryGuidance } = await loaded
  assert.match(getSourceRecoveryGuidance(failed('quota')).action, /billing/i)
  assert.match(getSourceRecoveryGuidance(failed('authorization')).action, /credential/i)
  assert.match(getSourceRecoveryGuidance(failed('network')).action, /network health/i)
  assert.equal(getSourceRecoveryGuidance({ status: 'completed' }), null)
})

test('unknown execution failures never attribute to a provider without evidence', async () => {
  const { getSourceRecoveryGuidance } = await loaded
  const result = getSourceRecoveryGuidance(failed('made_up'))
  assert.equal(result.category, 'execution')
  assert.match(result.attribution, /not verified/i)
})

test('recovery summary includes only actual failed executions', async () => {
  const { sourceRecoverySummary } = await loaded
  const summary = sourceRecoverySummary([failed('rate_limit'), failed('quota', '124'), {status: 'completed', category: null}])
  assert.equal(summary.failedRuns, 2)
  assert.equal(summary.byCategory.rate_limit, 1)
  assert.equal(summary.byCategory.quota, 1)
  assert.equal(summary.actionable.length, 2)
})

test('operator recovery view remains advisory and has no provider mutation or direct retry', () => {
  const ui = read('src/components/AcquisitionMonitoring.jsx')
  assert.match(ui, /sourceRecoverySummary\(runs\)/)
  assert.match(ui, /No provider is retried from this page/)
  assert.match(ui, /getSourceRecoveryGuidance\(run\)/)
  assert.doesNotMatch(ui, /triggerOpportunityEngine|\.update\(|\.insert\(|setTimeout/)
  assert.doesNotMatch(moduleSource, /fetch\(|supabase\.from\(|setInterval\(/)
})
