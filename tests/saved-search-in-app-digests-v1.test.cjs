const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

const loaded = import(pathToFileURL(join(__dirname, '../src/lib/savedDigestMatching.js')).href)
const sample = {
  title: 'WooCommerce checkout redesign',
  requirement: 'Need a WordPress developer for a checkout integration',
  source: 'freelancer', country: 'India', total_score: 81,
  published_at: '2026-11-07T10:00:00Z',
}

test('match filters respect source, score, country, recency, and buyer request', async () => {
  const { matchesSavedSearchOpportunity: match } = await loaded
  const saved = { query: 'WordPress', source: 'freelancer', country: 'India', min_score: '80', recency: '24' }
  const now = Date.parse('2026-11-07T12:00:00Z')
  assert.equal(match(sample, saved, now), true)
  assert.equal(match(sample, { ...saved, source: 'google' }, now), false)
  assert.equal(match(sample, { ...saved, country: 'USA' }, now), false)
  assert.equal(match(sample, { ...saved, min_score: '90' }, now), false)
  assert.equal(match(sample, { ...saved, query: 'plumbing' }, now), false)
  assert.equal(match(sample, { ...saved, recency: '24' }, now + 86400000), false)
  assert.equal(match({ ...sample, published_at: null }, saved, now), false)
})

test('digest time window excludes previously reviewed matches', async () => {
  const { digestWindowStart } = await loaded
  const now = Date.parse('2026-11-07T12:00:00Z')
  const saved = { in_app_digest_frequency: 'daily', digest_started_at: '2026-11-07T08:00:00Z', last_reviewed_at: '2026-11-07T10:00:00Z' }
  assert.equal(digestWindowStart(saved, now), '2026-11-07T10:00:00.000Z')
  assert.equal(digestWindowStart({ ...saved, in_app_digest_frequency: 'weekly', last_reviewed_at: null }, now), '2026-11-07T08:00:00.000Z')
  assert.equal(digestWindowStart({ ...saved, in_app_digest_frequency: 'off' }, now), null)
})

test('preferences never create autonomous searches or email delivery', () => {
  const service = readFileSync(join(__dirname, '../src/services/savedOpportunitySearches.js'), 'utf8')
  const page = readFileSync(join(__dirname, '../src/components/SavedSearchesPage.jsx'), 'utf8')
  const migration = readFileSync(join(__dirname, '../supabase/migrations/20261107144036_saved_search_in_app_digests_v1.sql'), 'utf8')
  assert(service.includes("from('opportunities')"))
  assert(service.includes(".eq('workspace_id', workspaceId)"))
  assert(service.includes("range(0, 1000)"))
  assert(!service.includes('triggerOpportunityEngine'))
  assert(!service.includes('fetch('))
  assert(page.includes('No scheduled emails'))
  assert(page.includes('Mark digest reviewed'))
  assert(migration.includes("default 'off'"))
  assert(!migration.includes('cron.schedule'))
})
