import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { interpretSerpApiHealth } from '../src/lib/providerHealthPresentation.js'

test('active provider cooldown displays a simple unavailable status', () => {
  const result = interpretSerpApiHealth({
    state: 'cooldown',
    cooldown_until: '2026-11-07T13:24:19Z',
  }, Date.parse('2026-11-06T18:00:00Z'))
  assert.equal(result.state, 'cooldown')
  assert.equal(result.label, 'Unavailable')
  assert.equal(result.detail, 'Google search is currently unavailable.')
})

test('monitor hides provider cooldown timestamp but retains guarded backend state', () => {
  const panel = readFileSync('src/components/ProviderHealthMonitor.jsx', 'utf8')
  assert.doesNotMatch(panel, /Cooldown ends:|row\.cooldownUntil/)
  const health = readFileSync('src/lib/providerHealthPresentation.js', 'utf8')
  assert.match(health, /state: 'cooldown'/)
  assert.match(health, /expires > now/)
  assert.match(health, /state: 'recovery_eligible'/)
})
