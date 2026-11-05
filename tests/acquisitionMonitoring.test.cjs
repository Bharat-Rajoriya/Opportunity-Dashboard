const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'src/services/acquisitionMonitoring.js'), 'utf8')
const ui = fs.readFileSync(path.join(root, 'src/components/AcquisitionMonitoring.jsx'), 'utf8')
const dashboard = fs.readFileSync(path.join(root, 'src/components/AcquisitionDiagnostics.jsx'), 'utf8')
const pureSource = source.replace("import { supabase } from '../lib/supabase'", '')
const loaded = import('data:text/javascript;base64,' + Buffer.from(pureSource).toString('base64'))

const completed = (overrides = {}) => ({
  id: 'run-1', master_execution_id: '123', run_started_at: '2026-11-05T08:00:00Z',
  run_finished_at: '2026-11-05T08:02:00Z', run_status: 'completed',
  health_status: 'healthy', error_message: null, health_warnings: [], ...overrides,
})

test('429 and rate-limit language are not incorrectly called quota exhaustion', async () => {
  const { classifyEngineFailure } = await loaded
  assert.equal(classifyEngineFailure('The service is receiving too many requests from you').kind, 'rate_limit')
  assert.equal(classifyEngineFailure('HTTP 429').kind, 'rate_limit')
  assert.equal(classifyEngineFailure('monthly quota exhausted').kind, 'quota')
  assert.equal(classifyEngineFailure('Unexpected workflow error').kind, 'execution')
})

test('completed run without candidate events is not an API failure', async () => {
  const { summarizeRunSignals } = await loaded
  const report = summarizeRunSignals(completed(), [])
  assert.equal(report.category, null)
  assert.equal(report.severity, 'warning')
  assert.match(report.label, /no candidate evaluation events/i)
})

test('a failed run without candidate events remains visible as failed', async () => {
  const { summarizeRunSignals } = await loaded
  const report = summarizeRunSignals(completed({
    run_status: 'failed', failed_step: '02 - Run Opportunity Research',
    error_message: 'The service is receiving too many requests from you',
  }))
  assert.equal(report.category, 'rate_limit')
  assert.equal(report.status, 'failed')
  assert.match(report.failedStep, /Research/)
})

test('critical health and duplicate-only runs have distinct findings', async () => {
  const { summarizeRunSignals } = await loaded
  const critical = summarizeRunSignals(completed({ health_status: 'critical' }),
    [{ master_execution_id: '123', evaluated_events: 30, qualified_events: 8, created_events: 6 }])
  assert.equal(critical.severity, 'error')
  assert.match(critical.label, /critical workflow health/)
  const duplicate = summarizeRunSignals(completed(),
    [{ master_execution_id: '123', evaluated_events: 30, qualified_events: 8, created_events: 0, duplicate_events: 8 }])
  assert.match(duplicate.label, /already saved/i)
})

test('running rows with a finish timestamp are flagged as inconsistent, not live', async () => {
  const { summarizeRunSignals } = await loaded
  const report = summarizeRunSignals(completed({ run_status: 'running' }))
  assert.match(report.label, /marked running after finish timestamp/)
})

test('monitoring reads only owned workspace run logs, never mutates records', () => {
  assert.match(source, /from\('engine_runs'\)/)
  assert.match(source, /\.eq\('workspace_id', workspaceId\)/)
  assert.match(source, /\.gte\('run_started_at', since\)/)
  assert.match(source, /limit\(MAX_RUNS \+ 1\)/)
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(/)
  assert.match(ui, /<table className="monitor-table">/)
  assert.match(ui, /funnelTruncated/)
  assert.match(dashboard, /<AcquisitionMonitoring workspaceId=\{workspaceId\}/)
})
