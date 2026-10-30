const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const appSource = readFileSync(
  join(__dirname, '../src/App.jsx'),
  'utf8'
).replace(/\r\n/g, '\n')

const migrationSource = readFileSync(
  join(__dirname, '../supabase/migrations/20261030_scope_budget_fit_v1.sql'),
  'utf8'
).replace(/\r\n/g, '\n')

const docsSource = readFileSync(
  join(__dirname, '../docs/scope-budget-fit-v1.md'),
  'utf8'
).replace(/\r\n/g, '\n')

test('opportunity query loads scope-to-budget fields', () => {
  for (const expected of [
    'scope_complexity',
    'scope_reason',
    'scope_multiplier',
    'scope_adjusted_min_value',
    'scope_budget_fit_ratio',
    'scope_budget_fit',
    'scope_budget_fit_reason',
  ]) {
    assert(appSource.includes(expected))
  }
})

test('opportunity drawer explains scope budget fit', () => {
  for (const expected of [
    'Budget fits scope',
    'Slightly below scope-adjusted minimum',
    'Budget materially below scope',
    'Budget far below scope',
    'Scope Complexity',
    'Scope Budget Fit',
    'scope-adjusted minimum',
  ]) {
    assert(appSource.includes(expected))
  }
})

test('scope budget migration is additive', () => {
  assert(migrationSource.includes('alter table public.opportunities'))
  assert(migrationSource.includes('add column if not exists scope_complexity text'))
  assert(migrationSource.includes('add column if not exists scope_budget_fit_ratio numeric'))
  assert(!migrationSource.toLowerCase().includes('drop column'))
})

test('scope policy is deterministic and budget-independent', () => {
  for (const expected of [
    'Do not use the posted budget to classify scope complexity',
    'small = 1×',
    'medium = 1.5×',
    'large = 2.5×',
    'very_large = 4×',
    'less than 40%',
    '40%–75%',
    '75%–100%',
    'Final Scoring applies the same policy',
  ]) {
    assert(docsSource.includes(expected))
  }
})
