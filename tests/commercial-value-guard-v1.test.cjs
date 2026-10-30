const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const appSource = readFileSync(
  join(__dirname, '../src/App.jsx'),
  'utf8'
).replace(/\r\n/g, '\n')

const migrationSource = readFileSync(
  join(__dirname, '../supabase/migrations/20261030_commercial_value_guard_v1.sql'),
  'utf8'
).replace(/\r\n/g, '\n')

const docsSource = readFileSync(
  join(__dirname, '../docs/commercial-value-guard-v1.md'),
  'utf8'
).replace(/\r\n/g, '\n')

test('opportunity query loads commercial value assessment fields', () => {
  for (const expected of [
    'commercial_fit',
    'budget_fit_ratio',
    'matched_service_min_value',
    'matched_service_currency',
    'normalized_budget_max',
    'commercial_value_reason',
  ]) {
    assert(appSource.includes(expected))
  }
})

test('opportunity drawer explains budget fit to the user', () => {
  for (const expected of [
    'Meets service minimum',
    'Below service minimum',
    'Far below service minimum',
    'Budget fit unknown',
    'Budget Fit',
    '% of service minimum',
  ]) {
    assert(appSource.includes(expected))
  }
})

test('commercial value migration is additive', () => {
  assert(migrationSource.includes('alter table public.opportunities'))
  assert(migrationSource.includes('add column if not exists commercial_fit text'))
  assert(migrationSource.includes('add column if not exists budget_fit_ratio numeric'))
  assert(!migrationSource.toLowerCase().includes('drop column'))
})

test('commercial value policy preserves unknown budgets and rejects only far-below explicit budgets', () => {
  for (const expected of [
    'Unknown budgets are never rejected',
    'less than 50%',
    '50% to below 100%',
    '15-point preliminary-score penalty',
    'Conservative currency normalization',
  ]) {
    assert(docsSource.includes(expected))
  }
})
