const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const appSource = readFileSync(
  join(__dirname, '../src/App.jsx'),
  'utf8'
).replace(/\r\n/g, '\n')

const onboardingSource = readFileSync(
  join(__dirname, '../src/components/Onboarding.jsx'),
  'utf8'
).replace(/\r\n/g, '\n')

const migrationSource = readFileSync(
  join(__dirname, '../supabase/migrations/20261030_provider_eligibility_guard_v1.sql'),
  'utf8'
).replace(/\r\n/g, '\n')

const docsSource = readFileSync(
  join(__dirname, '../docs/provider-eligibility-guard-v1.md'),
  'utf8'
).replace(/\r\n/g, '\n')

test('business profile captures provider eligibility inputs', () => {
  for (const expected of [
    'provider_country',
    'working_languages',
    'Base Country',
    'Working Languages',
    'Used only when an opportunity explicitly requires the provider',
  ]) {
    assert(appSource.includes(expected))
  }

  for (const expected of [
    'providerCountry',
    'workingLanguagesText',
    'Base Country',
    'Working Languages',
    'Please enter your base country',
    'Please add at least one working language',
  ]) {
    assert(onboardingSource.includes(expected))
  }
})

test('opportunity UI loads and explains eligibility facts', () => {
  for (const expected of [
    'project_language',
    'eligibility_match',
    'eligibility_restriction_type',
    'required_country',
    'required_language',
    'eligibility_reason',
    'Provider eligible',
    'Provider not eligible',
    'Eligibility not fully verified',
  ]) {
    assert(appSource.includes(expected))
  }
})

test('migration backfills working languages from preferred language', () => {
  for (const expected of [
    'add column if not exists provider_country text',
    "add column if not exists working_languages text[]",
    'set working_languages = array[preferred_language]::text[]',
    'add column if not exists eligibility_match text',
  ]) {
    assert(migrationSource.includes(expected))
  }
})

test('eligibility policy is conservative about country and language restrictions', () => {
  for (const expected of [
    'Buyer country is not provider eligibility',
    'Do not reject a remote opportunity',
    'platform project language',
    'description is written in another language',
    'unknown rather than rejecting',
  ]) {
    assert(docsSource.includes(expected))
  }
})
