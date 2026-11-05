const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

const load = import(pathToFileURL(join(__dirname, '../src/config/targetMarkets.js')).href)

test('market checkboxes support multiple simultaneous country selections', async () => {
  const { toggleTargetMarket } = await load
  const australia = ['Australia']
  const withUsa = toggleTargetMarket(australia, 'USA', true)
  assert.deepEqual(withUsa, ['Australia', 'USA'])
  assert.deepEqual(australia, ['Australia'], 'Input state must not be mutated')

  const withUk = toggleTargetMarket(withUsa, 'UK', true)
  assert.deepEqual(withUk, ['Australia', 'USA', 'UK'])
  assert.deepEqual(toggleTargetMarket(withUk, 'USA', true), withUk, 'No duplicates')
  assert.deepEqual(toggleTargetMarket(withUk, 'Australia', false), ['USA', 'UK'])
  assert.deepEqual(toggleTargetMarket(withUk, 'UAE', false), withUk)
})

test('country toggling preserves other saved markets and ignores invalid choices', async () => {
  const { toggleTargetMarket } = await load
  const choices = ['Canada', 'Australia', 'USA']
  assert.deepEqual(toggleTargetMarket(choices, 'India', true), [
    'Canada', 'Australia', 'USA', 'India',
  ])
  assert.deepEqual(toggleTargetMarket(choices, 'Not a country', true), choices)
  assert.deepEqual(toggleTargetMarket(['Australia', 'australia'], 'UK', true),
    ['Australia', 'UK'])
})

test('unsaved changes compare selections by membership, not checkbox order', async () => {
  const { hasUnsavedTargetMarkets } = await load
  assert.equal(hasUnsavedTargetMarkets(['Australia'], ['Australia']), false)
  assert.equal(hasUnsavedTargetMarkets(['Australia', 'USA'], ['Australia']), true)
  assert.equal(hasUnsavedTargetMarkets(['USA', 'Australia'], ['Australia', 'USA']), false)
  assert.equal(hasUnsavedTargetMarkets(['Australia'], ['USA', 'Australia']), true)
})

test('search running does not disable editing market checkboxes', () => {
  const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8')
  const start = app.indexOf('id="target-markets-title"')
  const fieldset = app.lastIndexOf('<fieldset', start)
  const end = app.indexOf('</fieldset>', start)
  assert(fieldset > 0 && end > start)
  const marketSection = app.slice(fieldset, end + '</fieldset>'.length)

  assert.match(marketSection, /disabled=\{searchSettingsSaving\}/)
  assert.doesNotMatch(marketSection, /disabled=\{searchSettingsSaving \|\| searchRunning\}/)
  assert.match(marketSection, /toggleTargetMarket\(current, country, event\.target\.checked\)/)
  assert.match(marketSection, /checked=\{targetCountries\.includes\(country\)\}/)
  assert.match(marketSection, /You can select multiple countries/)
  assert.match(marketSection, /Unsaved market changes/)
  assert.match(marketSection, /Discovery is running\. You can edit markets now/)
})

test('save remains unavailable until active search completes', () => {
  const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8')
  const buttonAt = app.indexOf('onClick={() => void saveSearchSettings()}')
  assert(buttonAt > 0)
  const block = app.slice(buttonAt, buttonAt + 500)
  assert.match(block, /searchSettingsSaving\s*\|\|\s*searchRunning/)
  assert.match(block, /targetCountries\.length === 0/)
})
