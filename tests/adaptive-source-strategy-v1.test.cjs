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
  join(__dirname, '../supabase/migrations/20261030_adaptive_source_strategy_v1.sql'),
  'utf8'
).replace(/\r\n/g, '\n')

const docsSource = readFileSync(
  join(__dirname, '../docs/adaptive-source-strategy-v1.md'),
  'utf8'
).replace(/\r\n/g, '\n')

test('adaptive strategy uses conservative traffic thresholds', () => {
  for (const expected of [
    'const minSample = 10',
    'const boostSample = 25',
    'qualificationRate >= 30',
    'qualificationRate >= 10',
    'trafficMultiplier = 0.5',
    'trafficMultiplier = 0.25',
    'resultLimitMultiplier = 1.5',
    'duplicateRate < 50',
  ]) {
    assert(analyticsSource.includes(expected))
  }
})

test('adaptive strategy UI is transparent about routing', () => {
  for (const expected of [
    'Adaptive routing',
    'strategy.label',
    '25% floor traffic',
    '25+ evaluated candidates',
    'never disables a source automatically',
  ]) {
    assert(appSource.includes(expected))
  }
})

test('source strategy metrics view always covers google and freelancer', () => {
  for (const expected of [
    'create or replace view public.source_strategy_metrics_v1',
    'security_invoker = true',
    "unnest(array['google'::text, 'freelancer'::text])",
    "e.created_at >= now() - interval '30 days'",
    "e.event_type = 'evaluated'",
    "e.event_type = 'qualified'",
  ]) {
    assert(migrationSource.includes(expected))
  }
})

test('adaptive strategy keeps floor traffic and delays boosting', () => {
  for (const expected of [
    'Sources are never automatically disabled',
    '25% floor traffic',
    '10 evaluated candidates',
    '25 evaluated candidates',
    '1.5×',
    '30-day',
  ]) {
    assert(docsSource.includes(expected))
  }
})
