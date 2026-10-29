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
    '../supabase/migrations/20261029_proof_profiles.sql'
  ),
  'utf8'
).replace(/\r\n/g, '\n')

test('settings present portfolio data as profession-agnostic Proof & Profiles', () => {
  for (const expected of [
    'PROOF &amp; PROFILES',
    'Proof &amp; Profiles',
    '+ Add Proof / Profile',
    'Proof Type',
    'Platform',
    'Profile / Portfolio Link',
    'Project / Work Sample',
    'Case Study',
    'Publication / Article',
    'Testimonial / Review',
    'Certification / Credential',
    'Services Represented',
    'Skills / Topics / Tools',
    'Link / Profile URL',
    'Evidence / Proof Points',
    'Use this as AI evidence',
  ]) {
    assert(appSource.includes(expected))
  }

  for (const legacy of [
    '<h2>Your Portfolio</h2>',
    '>Project Name',
    '>Technologies',
    '>Project URL',
    'Active Project',
  ]) {
    assert(!appSource.includes(legacy))
  }
})

test('proof/profile records persist generic type and platform metadata', () => {
  for (const expected of [
    'proof_type: proofType',
    'platform: platform || null',
    'proof_type: data.proof_type',
    'platform: data.platform',
  ]) {
    assert(appSource.includes(expected))
  }
})

test('database migration is additive and preserves the existing portfolio_items table', () => {
  assert(
    migrationSource.includes(
      "add column if not exists proof_type text not null default 'project'"
    )
  )
  assert(
    migrationSource.includes(
      'add column if not exists platform text'
    )
  )
  assert(
    migrationSource.includes(
      'portfolio_items_proof_type_check'
    )
  )
  assert(!migrationSource.includes('drop table'))
  assert(!migrationSource.includes('rename table'))
})
