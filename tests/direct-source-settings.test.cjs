const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const appSource = readFileSync(
  join(__dirname, '../src/App.jsx'),
  'utf8'
).replace(/\r\n/g, '\n')

const profileSource = readFileSync(
  join(__dirname, '../src/services/searchProfiles.js'),
  'utf8'
).replace(/\r\n/g, '\n')

test('direct source settings expose environment-aware source controls', () => {
  for (const expected of [
    'Opportunity Sources',
    'Google Web Search',
    'Freelancer',
    'Sandbox verified',
    'Production locked',
    'Results per query',
    'VITE_FREELANCER_PRODUCTION_ENABLED',
  ]) {
    assert(appSource.includes(expected))
  }
})

test('Freelancer live activation is environment-gated', () => {
  assert(
    appSource.includes(
      "import.meta.env.VITE_FREELANCER_PRODUCTION_ENABLED === 'true'"
    )
  )
  assert(appSource.includes('Production locked'))
  assert(appSource.includes('Live activation is intentionally locked'))
})

test('search profile save persists normalized sources and provider preferences', () => {
  for (const expected of [
    'normalizeSourcePreferences',
    'enabled_sources: normalizeSourceKeys(enabledSources)',
    'source_preferences: normalizeSourcePreferences(sourcePreferences)',
    'result_limit',
  ]) {
    assert(profileSource.includes(expected))
  }
})

test('Freelancer result limits are bounded to a safe range', () => {
  assert(
    profileSource.includes(
      'Math.max(1, Math.min(50, Math.round(requestedLimit)))'
    )
  )
})
