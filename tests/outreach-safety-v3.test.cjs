const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

const safety = import(pathToFileURL(join(__dirname, '../src/services/outreachSafety.js')).href)

test('exact high-scoring service fit does not require an override', async () => {
  const { requiresOutreachReview, manualPitchWarning } = await safety
  const lead = { recommended_action: 'pitch', total_score: 82,
    raw_payload: { service_match: { level: 'exact', evidence: 'WordPress' } } }
  assert.equal(requiresOutreachReview(lead), false)
  assert.equal(manualPitchWarning(lead), null)
})

test('related service fit is warned even with a high score', async () => {
  const { requiresOutreachReview, manualPitchWarning } = await safety
  const lead = { title: 'General web redesign', recommended_action: 'pitch', total_score: 88,
    raw_payload: { service_match: { level: 'related', evidence: 'website' } } }
  assert.equal(requiresOutreachReview(lead), true)
  assert.match(manualPitchWarning(lead), /manual review/i)
  assert.match(manualPitchWarning(lead), /does not send/i)
})

test('low-score and skip leads require explicit override', async () => {
  const { requiresOutreachReview, approvalWarning } = await safety
  const low = { recommended_action: 'research', total_score: 38 }
  const skipped = { recommended_action: 'skip', total_score: 91 }
  assert.equal(requiresOutreachReview(low), true)
  assert.equal(requiresOutreachReview(skipped), true)
  assert.match(approvalWarning(skipped), /manual override/i)
})

test('mark-as-sent requires confirmation that sending happened outside the app', async () => {
  const { markedAsSentPrompt } = await safety
  const msg = markedAsSentPrompt({ recommended_action: 'skip', total_score: 38 })
  assert.match(msg, /Have you already sent/i)
  assert.match(msg, /does NOT send/i)
  assert.match(msg, /not recommended/i)
})

test('dashboard wires confirmation at manual pitch, approval and mark-sent boundaries', () => {
  const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8')
  assert.match(app, /window\.confirm\(markedAsSentPrompt\(lead\)\)/)
  assert.match(app, /const warning = manualPitchWarning\(opportunity\)/)
  assert.match(app, /const warning = approvalWarning\(lead\)/)
  assert.match(app, /I Sent This Manually/)
  assert.match(app, /Recording it as sent does not send or verify delivery/)
  assert.match(app, /recommended_action,\s+raw_payload,\s+research_status,\s+research_detail_reason,\s+budget_text/)
  assert.match(app, /estimated_value_min,\s+estimated_value_max,\s+estimated_currency,\s+outreach_status/)
})
