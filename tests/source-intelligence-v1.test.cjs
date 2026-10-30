const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const appSource = readFileSync(
  join(__dirname, '../src/App.jsx'),
  'utf8'
).replace(/\r\n/g, '\n')

const analyticsSource = readFileSync(
  join(__dirname, '../src/services/sourceAnalytics.js'),
  'utf8'
).replace(/\r\n/g, '\n')

const migrationSource = readFileSync(
  join(__dirname, '../supabase/migrations/20261030_source_intelligence_v1.sql'),
  'utf8'
).replace(/\r\n/g, '\n')

test('source intelligence UI exposes 30-day source scorecards', () => {
  for (const expected of [
    'fetchSourceAnalytics',
    'sourceAnalyticsLoading',
    'Evaluated',
    'Qualified',
    'Created',
    'Duplicates',
    'Avg score',
    'qualificationRate',
    'duplicateRate',
  ]) {
    assert(appSource.includes(expected))
  }
})

test('source analytics aggregation tracks lifecycle metrics', () => {
  for (const expected of [
    "eventType === 'evaluated'",
    "eventType === 'rejected'",
    "eventType === 'qualified'",
    "eventType === 'duplicate'",
    "eventType === 'created'",
    'qualified / summary.evaluated',
    'duplicates / summary.qualified',
    'qualifiedScoreTotal / summary.qualifiedScoreCount',
  ]) {
    assert(analyticsSource.includes(expected))
  }
})

test('source analytics only reads the authenticated workspace history', () => {
  assert(analyticsSource.includes(".from('source_candidate_events')"))
  assert(analyticsSource.includes(".eq('workspace_id', workspaceId)"))
  assert(analyticsSource.includes(".gte('created_at', since)"))
})

test('source event table has workspace-scoped RLS and lifecycle constraints', () => {
  for (const expected of [
    'create table if not exists public.source_candidate_events',
    "event_type in ('evaluated', 'rejected', 'qualified', 'duplicate', 'created')",
    'alter table public.source_candidate_events enable row level security',
    'Users can view own source analytics',
    'w.owner_user_id = auth.uid()',
  ]) {
    assert(migrationSource.includes(expected))
  }
})
