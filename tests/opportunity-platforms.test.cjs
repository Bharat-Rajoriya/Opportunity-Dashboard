const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')
const load = import(pathToFileURL(join(__dirname, '../src/services/opportunityPlatforms.js')).href)

const leads = [
  { id: 'a', source: 'freelancer', score_stage: 'final', total_score: 73, created_at: '2026-11-02T12:00:00Z' },
  { id: 'b', source: 'google', score_stage: 'final', total_score: 86, created_at: '2026-11-03T12:00:00Z' },
  { id: 'c', source: 'Freelancer', score_stage: 'preliminary', preliminary_score: 91, created_at: '2026-11-04T12:00:00Z' },
  { id: 'd', source: 'reddit', score_stage: 'final', total_score: 68, created_at: '2026-11-05T12:00:00Z' },
  { id: 'e', source: 'Upwork', score_stage: 'final', total_score: 80, created_at: '2026-11-01T12:00:00Z' },
]

test('platform options come from saved opportunities, not imagined active providers', async () => {
  const { getOpportunityPlatformOptions } = await load
  const options = getOpportunityPlatformOptions(leads)
  assert.deepEqual(options.map(o => [o.value, o.count]), [
    ['freelancer', 2], ['google', 1], ['upwork', 1], ['reddit', 1],
  ])
  assert.equal(options.find(o => o.value === 'google').label, 'Google Search')
  const limited = getOpportunityPlatformOptions(leads.slice(0, 3))
  assert(!limited.some(o => o.value === 'reddit'))
  assert(!limited.some(o => o.value === 'upwork'))
})

test('platform filters support two favorite sources together and clear to all', async () => {
  const { toggleOpportunityPlatform, matchesOpportunityPlatforms } = await load
  let selected = toggleOpportunityPlatform([], 'freelancer')
  selected = toggleOpportunityPlatform(selected, 'GOOGLE')
  assert.deepEqual(selected, ['freelancer', 'google'])
  assert.deepEqual(leads.filter(o => matchesOpportunityPlatforms(o, selected)).map(o => o.id),
    ['a', 'b', 'c'])
  selected = toggleOpportunityPlatform(selected, 'Freelancer')
  assert.deepEqual(selected, ['google'])
  assert.deepEqual(leads.filter(o => matchesOpportunityPlatforms(o, selected)).map(o => o.id), ['b'])
  assert.equal(leads.filter(o => matchesOpportunityPlatforms(o, [])).length, leads.length)
})

test('new and future platforms automatically appear, including source aliases', async () => {
  const { getOpportunityPlatformOptions, getOpportunityPlatform } = await load
  const options = getOpportunityPlatformOptions([
    { source: 'google_web' }, { source: 'serpapi_google' },
    { source: 'freelancer_api' }, { source: 'peopleperhour' },
    { source: 'some_future_source' },
  ])
  assert.equal(options.find(o => o.value === 'google').count, 2)
  assert.equal(options.find(o => o.value === 'freelancer').count, 1)
  assert.equal(options.find(o => o.value === 'peopleperhour').label, 'PeoplePerHour')
  assert.equal(options.find(o => o.value === 'some_future_source').label, 'Some Future Source')
  assert.equal(getOpportunityPlatform(null), 'other')
})

test('previous selected sources remain visible with count zero after refresh', async () => {
  const { getOpportunityPlatformOptions } = await load
  const choices = getOpportunityPlatformOptions([{ source: 'google' }], ['freelancer'])
  assert.deepEqual(choices.map(item => [item.value, item.count]), [
    ['freelancer', 0], ['google', 1],
  ])
})

test('default score ordering separates final vs initial scores, never mutates the list', async () => {
  const { sortOpportunities } = await load
  const original = leads.map(o => o.id)
  const result = sortOpportunities(leads, 'score')
  assert.deepEqual(result.map(o => o.id), ['b', 'e', 'a', 'd', 'c'])
  assert.deepEqual(leads.map(o => o.id), original)
})

test('newest and platform sorting work independently of active source filters', async () => {
  const { sortOpportunities } = await load
  assert.deepEqual(sortOpportunities(leads, 'newest').map(o => o.id), ['d', 'c', 'b', 'a', 'e'])
  assert.deepEqual(sortOpportunities(leads, 'platform').map(o => o.id), ['c', 'a', 'b', 'd', 'e'])
})

test('missing scores are not treated as a confirmed zero or superior to final scores', async () => {
  const { sortOpportunities } = await load
  const unordered = [
    { id:'pre', score_stage:'preliminary', preliminary_score:90 },
    { id:'unknown', score_stage:'final', total_score:null },
    { id:'final', score_stage:'final', total_score:12 },
  ]
  assert.deepEqual(sortOpportunities(unordered).map(x => x.id), ['final','pre','unknown'])
})

test('opportunity interface preserves all existing filters and wires platform controls', () => {
  const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8')
  const filters = readFileSync(join(__dirname, '../src/components/OpportunityPlatformFilters.jsx'), 'utf8')
  const css = readFileSync(join(__dirname, '../src/opportunity-platforms.css'), 'utf8')

  assert(app.includes('<OpportunityPlatformFilters'))
  assert(app.includes('onToggle={(platform) => setSelectedPlatforms(current => toggleOpportunityPlatform(current, platform))}'))
  assert(app.includes('onSortChange={setOpportunitySort}'))
  assert(app.includes('matchesOpportunityPlatforms(opportunity, selectedPlatforms)'))
  assert(app.includes('matchesSearch &&'))
  assert(app.includes('matchesAction &&'))
  assert(app.includes('matchesDraft &&'))
  assert(app.includes('matchesFollowUp'))
  assert(app.includes('filteredOpportunities.map((opportunity)'))
  assert(filters.includes('aria-pressed={selectedPlatforms.includes(platform.value)}'))
  assert(filters.includes('All platforms'))
  assert(filters.includes('This does not change which platforms discovery searches.'))
  assert(css.includes('@media(max-width:600px)'))
})
