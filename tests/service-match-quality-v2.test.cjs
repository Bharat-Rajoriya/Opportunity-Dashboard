const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

const modulePromise = import(pathToFileURL(join(__dirname, '../src/services/serviceMatch.js')).href)

test('legacy opportunities remain unlabeled rather than implying V2 evidence', async () => {
  const { getServiceMatchDetails } = await modulePromise
  assert.equal(getServiceMatchDetails(null), null)
  assert.equal(getServiceMatchDetails({ raw_payload: {} }), null)
  assert.equal(getServiceMatchDetails({ raw_payload: { service_match: { level: 'unknown' } } }), null)
})

test('exact match keeps explicit buyer evidence visible', async () => {
  const { getServiceMatchDetails } = await modulePromise
  const match = getServiceMatchDetails({
    raw_payload: { service_match: { level: 'exact', evidence: 'WordPress', reason: 'Buyer requires WordPress.' } },
  })
  assert.equal(match.level, 'exact')
  assert.equal(match.label, 'Exact service match')
  assert.equal(match.evidence, 'WordPress')
  assert.equal(match.reason, 'Buyer requires WordPress.')
  assert.equal(match.canAutoPitch, true)
})

test('related match disallows automatic pitch and gives clear warning', async () => {
  const { getServiceMatchDetails } = await modulePromise
  const match = getServiceMatchDetails({
    raw_payload: { service_match: { level: 'related', evidence: 'website', reason: 'Platform unspecified.' } },
  })
  assert.equal(match.level, 'related')
  assert.equal(match.canAutoPitch, false)
  assert.match(match.label, /Related service/)
})

test('unverified exact classifications are presented conservatively', async () => {
  const { getServiceMatchDetails } = await modulePromise
  const match = getServiceMatchDetails({
    raw_payload: { service_match: { level: 'exact', evidence: '', reason: 'No quote.' } },
  })
  assert.equal(match.level, 'related')
  assert.equal(match.canAutoPitch, false)
})

test('unsupported service is never shown as a pitchable match', async () => {
  const { getServiceMatchDetails } = await modulePromise
  const match = getServiceMatchDetails({
    raw_payload: { service_match: { level: 'unsupported', evidence: 'graphic designer' } },
  })
  assert.equal(match.level, 'unsupported')
  assert.equal(match.canAutoPitch, false)
})

test('dashboard requests service-match metadata and explains fit in card and drawer', () => {
  const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8')
  assert(app.includes("import { getServiceMatchDetails } from './services/serviceMatch'"))
  assert(app.includes('          raw_payload,\\n          source_result_type,'.replace('\\n', '\n')))
  assert(app.includes('Buyer evidence: “{serviceMatch.evidence}”'))
  assert(app.includes('Automatic pitch recommendation is disabled.'))
  assert(app.includes('title={serviceMatch.reason || serviceMatch.label}'))
})
