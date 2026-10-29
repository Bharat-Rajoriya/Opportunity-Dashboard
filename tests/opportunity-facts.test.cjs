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
    '../supabase/migrations/20261029_opportunity_facts.sql'
  ),
  'utf8'
).replace(/\r\n/g, '\n')

test('opportunity query loads source-supported commercial and contact facts', () => {
  for (const expected of [
    'budget_text',
    'estimated_value_min',
    'estimated_value_max',
    'estimated_currency',
    'contact_email',
    'contact_phone',
    'project_type',
    'duration_text',
    'workload_text',
    'experience_level',
    'location_text',
    'remote_status',
    'skills',
  ]) {
    assert(appSource.includes(expected))
  }
})

test('opportunity drawer shows compact facts only when evidence exists', () => {
  for (const expected of [
    'Opportunity Facts',
    'Posted Budget / Rate',
    'Estimated Value',
    'Project Type',
    'Duration',
    'Workload',
    'Experience Level',
    'Public Email',
    'Public Phone',
    'Skills / Expertise',
  ]) {
    assert(appSource.includes(expected))
  }

  assert(
    appSource.includes(
      '(opportunityFacts.length > 0 ||'
    )
  )
})

test('explicit budget is preferred over estimated value', () => {
  const start = appSource.indexOf(
    'const opportunityFacts = ['
  )
  const end = appSource.indexOf(
    '].filter(Boolean)',
    start
  )

  assert(start >= 0 && end > start)

  const facts = appSource.slice(start, end)

  assert(facts.includes('opportunity.budget_text &&'))
  assert(
    facts.includes(
      '!opportunity.budget_text &&'
    )
  )
  assert(facts.includes("note: 'Estimate'"))
})

test('contact actions use mailto and tel links without exposing hidden data', () => {
  assert(
    appSource.includes(
      'href: `mailto:${opportunity.contact_email}`'
    )
  )
  assert(
    appSource.includes(
      'href: `tel:${opportunity.contact_phone.replace'
    )
  )
})

test('opportunity facts migration is additive', () => {
  for (const expected of [
    'add column if not exists contact_email text',
    'add column if not exists contact_phone text',
    'add column if not exists project_type text',
    'add column if not exists duration_text text',
    'add column if not exists workload_text text',
    'add column if not exists experience_level text',
    'add column if not exists location_text text',
    'add column if not exists remote_status text',
    "add column if not exists skills text[] not null default '{}'",
  ]) {
    assert(migrationSource.includes(expected))
  }

  assert(!migrationSource.includes('drop table'))
})
