const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

const read = path => readFileSync(join(__dirname, '..', path), 'utf8')
const onboard = read('src/components/Onboarding.jsx')
const sourcesModule = import(pathToFileURL(join(__dirname, '../src/config/discoverySources.js')).href)

test('onboarding presents active and planned platforms with transparent availability', () => {
  assert.match(onboard, /Where should we find opportunities\?/)
  assert.match(onboard, /Choose one or more available sources/)
  assert.match(onboard, /Google Web Search/)
  assert.match(onboard, /Freelancer/)
  assert.match(onboard, /Upwork/)
  assert.match(onboard, /Reddit/)
  assert.match(onboard, /Pending permission for a compliant integration/)
  assert.match(onboard, /not a guarantee that a provider is online/)
})

test('Upwork and Reddit options are disabled and unchecked, not silently added', () => {
  assert.match(onboard, /<input type="checkbox" disabled checked=\{false\} aria-label="Upwork coming soon"/)
  assert.match(onboard, /<input type="checkbox" disabled checked=\{false\} aria-label="Reddit coming soon"/)
  assert.doesNotMatch(onboard, /toggleOnboardingSource\(sources, 'upwork'/)
  assert.doesNotMatch(onboard, /toggleOnboardingSource\(sources, 'reddit'/)
})

test('existing source defaults preserve Google and configured Freelancer choices', async () => {
  const { defaultDiscoverySources, toggleOnboardingSource } = await sourcesModule
  assert.deepEqual(defaultDiscoverySources(true), ['google', 'freelancer'])
  assert.deepEqual(defaultDiscoverySources(false), ['google'])
  assert.deepEqual(toggleOnboardingSource(['google','freelancer'], 'upwork', true, true), ['google', 'freelancer'])
  assert.deepEqual(toggleOnboardingSource(['google'], 'reddit', true, false), ['google'])
  assert.deepEqual(toggleOnboardingSource(['google','freelancer'], 'freelancer', false, true), ['google'])
})

test('onboarding still blocks saving when no active sources are selected', () => {
  assert.match(onboard, /onboardingSources\.length === 0/)
  assert.match(onboard, /Select at least one available source to continue/)
  assert.match(onboard, /enabled_sources: onboardingSources/)
})
