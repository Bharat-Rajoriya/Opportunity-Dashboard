const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

const load = import(pathToFileURL(join(__dirname, '../src/services/outreachPresentation.js')).href)

test('outreach lead context distinguishes actual score, service fit, and research status', async () => {
  const { getOutreachLeadContext } = await load
  const related = getOutreachLeadContext({
    total_score: 44, research_status: 'partial',
    recommended_action: 'skip',
    raw_payload: { service_match: { level: 'related', evidence: 'website', reason: 'Platform not named.' } },
  })
  assert.equal(related.score, 44)
  assert.equal(related.match.level, 'related')
  assert.equal(related.researchLabel, 'Partial research')
  assert.equal(related.needsReview, true)
  assert.equal(related.researchNeedsReview, true)
  assert.equal(related.budget.value, 'Not specified')
  const unknown = getOutreachLeadContext({ total_score: null })
  assert.equal(unknown.score, null)
  assert.equal(unknown.researchLabel, 'Research not assessed')
})

test('listed budget is not replaced by unverified estimate in outreach review', async () => {
  const { getOutreachLeadContext } = await load
  const context = getOutreachLeadContext({
    budget_text: '$300 fixed',
    estimated_value_min: 900, estimated_value_max: 2000,
    outreach_channel: 'Freelancer',
  })
  assert.equal(context.budget.kind, 'listed')
  assert.equal(context.budget.value, '$300 fixed')
  assert.equal(context.channel, 'Freelancer')
})

test('only validated source URLs are offered for manual sending', async () => {
  const { getOutreachLeadContext, getSendInstruction } = await load
  const unsafe = { source_url: 'javascript:alert(1)' }
  assert.equal(getOutreachLeadContext(unsafe).sourceUrl, null)
  assert.match(getSendInstruction(unsafe), /No valid listing link is saved/)
  const safe = { source_url: 'https://www.freelancer.com/projects/demo' }
  assert.equal(getOutreachLeadContext(safe).sourceUrl, safe.source_url)
  assert.match(getSendInstruction(safe), /send it there yourself/i)
})

test('draft word counters count real words, not whitespace', async () => {
  const { getDraftWordCount } = await load
  assert.equal(getDraftWordCount(null), 0)
  assert.equal(getDraftWordCount('   '), 0)
  assert.equal(getDraftWordCount('Hello,\n we can help.  '), 4)
})

test('outreach summary never invents negative counts or delivery confirmations', async () => {
  const { getOutreachSummary } = await load
  assert.deepEqual(getOutreachSummary(2, 4), { pending: 2, ready: 4, total: 6 })
  assert.deepEqual(getOutreachSummary(-2, NaN), { pending: 0, ready: 0, total: 0 })
})

test('review and approved queues preserve original approval and manual-send actions', () => {
  const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8')
  const context = readFileSync(join(__dirname, '../src/components/OutreachLeadContext.jsx'), 'utf8')
  const css = readFileSync(join(__dirname, '../src/outreach-v2.css'), 'utf8')
  assert(app.includes('id="workspace-outreach"'))
  assert(app.includes('outreach-v2-review-card'))
  assert(app.includes('outreach-v2-approved-card'))
  assert(app.includes('onClick={() => void approveOpportunity(lead)}'))
  assert(app.includes('onClick={() => void saveEditedOpportunity(lead)}'))
  assert(app.includes('onClick={() => void rejectOpportunity()}'))
  assert(app.includes('onClick={() => void copyApprovedMessage(lead)}'))
  assert(app.includes('onClick={() => void markOutreachAsSent(lead)}'))
  assert(app.includes('I Sent This Manually'))
  assert(app.includes('const warning = approvalWarning(lead)'))
  assert(app.includes('if (warning && !window.confirm(warning)) return'))
  assert(context.includes('getOutreachLeadContext(lead)'))
  assert(css.includes('@media(max-width:640px)'))
  assert(css.includes('prefers-reduced-motion'))
})
