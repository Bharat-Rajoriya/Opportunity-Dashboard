const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const serviceSource = readFileSync(
  join(__dirname, '../src/services/searchProfiles.js'),
  'utf8'
).replace(/\r\n/g, '\n')

const migrationSource = readFileSync(
  join(
    __dirname,
    '../supabase/migrations/20261030_direct_source_foundation.sql'
  ),
  'utf8'
).replace(/\r\n/g, '\n')

const contractSource = readFileSync(
  join(__dirname, '../docs/direct-source-collectors.md'),
  'utf8'
).replace(/\r\n/g, '\n')

test('search profile loads direct-source configuration without exposing secrets', () => {
  for (const expected of [
    'enabled_sources',
    'source_preferences',
    'normalizeSourceKeys',
    "'google'",
    "'freelancer'",
    "'upwork'",
    "'reddit'",
    "'peopleperhour'",
  ]) {
    assert(serviceSource.includes(expected))
  }

  for (const forbidden of [
    'oauth_token',
    'access_token',
    'refresh_token',
    'client_secret',
  ]) {
    assert(!serviceSource.toLowerCase().includes(forbidden))
  }
})

test('source keys fall back to Google when configuration is empty or unsupported', () => {
  assert(serviceSource.includes("return normalized.length > 0"))
  assert(serviceSource.includes(": ['google']"))
})

test('multi-source migration is additive and defaults existing profiles to Google', () => {
  for (const expected of [
    'add column if not exists enabled_sources text[]',
    "default array['google']::text[]",
    'add column if not exists source_preferences jsonb',
    "default '{}'::jsonb",
    "set enabled_sources = array['google']::text[]",
  ]) {
    assert(migrationSource.includes(expected))
  }

  assert(!migrationSource.includes('drop table'))
})

test('direct-source contract keeps provider credentials server-side', () => {
  for (const expected of [
    'Canonical direct-source candidate',
    'source_item_id',
    'source_quality_score',
    'buyer_likelihood',
    'Freelancer Direct Source Collector V1',
    'server-side Freelancer OAuth2 credential',
  ]) {
    assert(contractSource.includes(expected))
  }

  assert(
    contractSource.includes(
      'Never store OAuth access tokens, client secrets, API keys or refresh tokens'
    )
  )
})
