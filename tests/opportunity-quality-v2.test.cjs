const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const appSource = readFileSync(
  join(__dirname, '../src/App.jsx'),
  'utf8'
).replace(/\r\n/g, '\n')

const migrationSource = readFileSync(
  join(
    __dirname,
    '../supabase/migrations/20261030_opportunity_quality_v2.sql'
  ),
  'utf8'
).replace(/\r\n/g, '\n')

test('opportunity query loads source-quality assessment fields', () => {
  for (const expected of [
    'source_result_type',
    'source_quality_score',
    'source_quality_reason',
    'buyer_likelihood',
  ]) {
    assert(appSource.includes(expected))
  }
})

test('opportunity drawer explains source quality instead of hiding classifier confidence', () => {
  for (const expected of [
    'Source quality',
    'Strong source evidence',
    'Good source evidence',
    'Limited source evidence',
    'Weak source evidence',
    'buyer likelihood',
    'source_quality_reason',
  ]) {
    assert(appSource.includes(expected))
  }
})

test('source-quality UI only appears for assessed opportunities', () => {
  assert(
    appSource.includes(
      'const hasSourceQualityAssessment ='
    )
  )
  assert(
    appSource.includes(
      '{hasSourceQualityAssessment && ('
    )
  )
})

test('Opportunity Quality v2 migration is additive and bounds quality score', () => {
  for (const expected of [
    'add column if not exists source_result_type text',
    'add column if not exists source_quality_score numeric not null default 0',
    'add column if not exists source_quality_reason text',
    'add column if not exists buyer_likelihood text',
    'source_quality_score >= 0',
    'source_quality_score <= 10',
  ]) {
    assert(migrationSource.includes(expected))
  }

  assert(!migrationSource.includes('drop table'))
})
