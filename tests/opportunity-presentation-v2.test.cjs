const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

const load = import(pathToFileURL(join(__dirname, '../src/services/opportunityPresentation.js')).href)

test('listed buyer budget takes precedence over model estimates', async () => {
  const { getOpportunityBudget } = await load
  const budget = getOpportunityBudget({
    budget_text: '$600 - $1,000 USD', estimated_value_min: 100, estimated_value_max: 150,
  })
  assert.equal(budget.kind, 'listed')
  assert.equal(budget.value, '$600 - $1,000 USD')
  assert.match(budget.detail, /confirm with the buyer/i)
})

test('estimated value is clearly labeled as not confirmed', async () => {
  const { getOpportunityBudget } = await load
  const value = getOpportunityBudget({ estimated_value_min: 800, estimated_value_max: 1400, estimated_currency: 'USD' })
  assert.equal(value.kind, 'estimated')
  assert.match(value.label, /Estimated/)
  assert.match(value.value, /800/)
  assert.match(value.value, /1,400/)
  assert.match(value.detail, /not a confirmed buyer budget/i)
})

test('unknown or invalid budget does not masquerade as zero', async () => {
  const { getOpportunityBudget } = await load
  for (const input of [{}, { estimated_value_min: 0, estimated_value_max: null },
    { estimated_value_max: -100 }, { estimated_value_min: 'NaN' }]) {
    assert.equal(getOpportunityBudget(input).value, 'Not specified')
  }
  assert.match(getOpportunityBudget({ estimated_value_max: 500 }).value, /Up to/)
  assert.doesNotThrow(() => getOpportunityBudget({ estimated_value_min: 200, estimated_currency: 'bad!' }))
})

test('final and preliminary scores are differentiated and missing score stays unknown', async () => {
  const { getOpportunityScore } = await load
  assert.deepEqual(getOpportunityScore({ score_stage: 'final', total_score: 73, preliminary_score: 31 }),
    { label: 'Final score', value: 73, stage: 'final',
      detail: 'Opportunity prioritization score; not a probability of winning.' })
  const initial = getOpportunityScore({ score_stage: 'preliminary', total_score: 86, preliminary_score: 25 })
  assert.equal(initial.label, 'Initial score')
  assert.equal(initial.value, 25)
  assert.equal(getOpportunityScore({ score_stage: 'final', total_score: 0 }).value, 0)
  assert.equal(getOpportunityScore({ score_stage: 'final', total_score: null }).value, null)
  assert.equal(getOpportunityScore({ score_stage: 'unknown', total_score: 75 }).value, null)
})

test('partial research never implies buyer identity verification', async () => {
  const { getOpportunityResearch } = await load
  assert.equal(getOpportunityResearch({ research_status: 'partial' }).tone, 'partial')
  assert.match(getOpportunityResearch({ research_status: 'partial' }).detail, /may be unverified/i)
  assert.match(getOpportunityResearch({ research_status: 'completed' }).detail, /does not verify the buyer/i)
  assert.equal(getOpportunityResearch({ research_status: 'pending' }).label, 'Research pending')
})

test('unreliable source links are not rendered as navigation links', async () => {
  const { getSafeSourceUrl } = await load
  for (const value of ['javascript:alert(1)', 'data:text/plain,test', '/project/foo',
    'https://', 'mailto:test@example.com']) {
    assert.equal(getSafeSourceUrl({ source_url: value }), null)
  }
  assert.equal(getSafeSourceUrl({ source_url: 'https://www.freelancer.com/projects/demo' }),
    'https://www.freelancer.com/projects/demo')
})

test('preview truncates long requirements and explains missing requirements', async () => {
  const { getRequirementPreview } = await load
  assert.match(getRequirementPreview({}), /No buyer requirement available/)
  const output = getRequirementPreview({ requirement: 'Build a modern website '.repeat(40) }, 95)
  assert(output.length <= 95)
  assert(output.endsWith('…'))
})

test('action labels never claim a pitch has already been delivered', async () => {
  const { getOpportunityAction, getOpportunityPresentation } = await load
  assert.match(getOpportunityAction({ recommended_action: 'skip' }).detail, /does not recommend outreach/)
  assert.match(getOpportunityAction({ recommended_action: 'pitch' }).detail, /not authorized or automatically sent/)
  assert.equal(getOpportunityPresentation({}).serviceMatch, null)
})

test('new card and details preserve existing actions and source safeguards', () => {
  const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8')
  const facts = readFileSync(join(__dirname, '../src/components/OpportunityFactsStrip.jsx'), 'utf8')
  const css = readFileSync(join(__dirname, '../src/opportunity-v2.css'), 'utf8')
  assert(app.includes('className="opp-v2-card"'))
  assert.equal((app.match(/<OpportunityFactsStrip/g) || []).length, 2)
  assert(app.includes('className="opp-v2-drawer-close"'))
  assert(app.includes('aria-modal="true"'))
  assert(app.includes('aria-labelledby="opportunity-drawer-title"'))
  assert(app.includes('onClick={onGeneratePitch}'))
  assert(app.includes('onClick={onViewDetails}'))
  assert(app.includes('href={view.sourceUrl}'))
  assert(app.includes("title=\"Buyer's Requirements\""))
  assert(app.includes('<DrawerSection title="AI Outreach Draft">'))
  assert(app.includes('<DrawerSection title="Opportunity Status">'))
  assert(app.includes('onScheduleFollowUp={scheduleOpportunityFollowUp}'))
  assert(facts.includes('getOpportunityPresentation(opportunity)'))
  assert(css.includes('@media(max-width:640px)'))
})
