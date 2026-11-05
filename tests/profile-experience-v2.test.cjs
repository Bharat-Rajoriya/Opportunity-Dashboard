const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

const load = import(pathToFileURL(join(__dirname, '../src/config/profileExperience.js')).href)
const profile = {
  business_name: 'Example Creative Studio', business_type: 'small_agency',
  provider_country: 'India', preferred_language: 'English',
  working_languages: ['English', 'Hindi'],
  primary_goal: 'Find buyers requesting a website redesign',
  ideal_client_types: ['Local businesses'],
  good_opportunity_definition: 'Buyer requests an actual website and budget',
}

test('onboarding stepper displays all five stages with scoped guidance', async () => {
  const { ONBOARDING_STEPS, getOnboardingStepMeta } = await load
  assert.equal(ONBOARDING_STEPS.length, 5)
  assert.deepEqual(ONBOARDING_STEPS.map(item => item.title),
    ['Business', 'Services', 'Ideal Buyers', 'Discovery', 'Proof'])
  assert.equal(getOnboardingStepMeta(5).title, 'Proof')
  assert.match(getOnboardingStepMeta(4).tip, /does not guarantee/i)
  assert.match(getOnboardingStepMeta(5).tip, /can substantiate/i)
  assert.equal(getOnboardingStepMeta(0).id, 1)
})

test('profile checklist counts only provided essentials, not AI confidence', async () => {
  const { getProfileOverview } = await load
  const info = getProfileOverview(profile,
    [{ active: true, name: 'Web development' }, { active: false, name: 'Design' }],
    [{ active: true, proof_type: 'profile' }])
  assert.equal(info.completed, 4)
  assert.equal(info.total, 4)
  assert.equal(info.activeServiceCount, 1)
  assert.equal(info.activeProofCount, 1)
  assert.equal(info.pending, false)
  assert(info.essentials.every(item => item.ready))
  assert(info.optional.every(item => item.ready))
  assert.match(info.note, /does not verify your claims or predict lead quality/i)
})

test('missing goal, location or services remain visibly incomplete', async () => {
  const { getProfileOverview } = await load
  const info = getProfileOverview({
    business_name: 'Studio', business_type: 'freelancer',
    provider_country: '', preferred_language: '', working_languages: [],
    primary_goal: '',
  }, [], [])
  assert.equal(info.completed, 1)
  assert.equal(info.essentials.filter(item => !item.ready).length, 3)
  assert.equal(info.optional.filter(item => !item.ready).length, 2)
  assert.equal(info.activeServiceCount, 0)
  assert.equal(info.activeProofCount, 0)
})

test('checklist does not turn loading services or proof into confirmed zero', async () => {
  const { getProfileOverview } = await load
  const info = getProfileOverview(profile, [], [], {
    servicesLoading: true, proofsLoading: true,
  })
  assert.equal(info.pending, true)
  assert.equal(info.essentials.find(item => item.id === 'services').loading, true)
  assert.equal(info.optional.find(item => item.id === 'proof').loading, true)
  assert.equal(info.completed, 3)
})

test('proof helpers explain relevant fields without suggesting invented outcomes', async () => {
  const { getProofTypeTip } = await load
  assert.match(getProofTypeTip('profile'), /do not need a platform integration/i)
  assert.match(getProofTypeTip('case_study'), /verifiable outcome/i)
  assert.match(getProofTypeTip('testimonial'), /avoid invented endorsements/i)
  assert.match(getProofTypeTip('certification'), /valid credential/i)
})

test('closing unchanged Business Profile does not request unnecessary confirmation', async () => {
  const { hasUnsavedProfileChanges } = await load
  assert.equal(hasUnsavedProfileChanges({
    ...profile, website_url: '', rejection_rules: [],
  }, {
    ...profile, website_url: null, rejection_rules: null,
  }), false)
  assert.equal(hasUnsavedProfileChanges({
    ...profile, working_languages: ['Hindi', 'English'],
  }, profile), false)
})

test('actual changed business, goal and targeting require confirmation', async () => {
  const { hasUnsavedProfileChanges } = await load
  assert.equal(hasUnsavedProfileChanges({ ...profile, primary_goal: 'Another goal' }, profile), true)
  assert.equal(hasUnsavedProfileChanges({ ...profile, website_url: 'https://example.org' }, profile), true)
  assert.equal(hasUnsavedProfileChanges({ ...profile, rejection_rules: ['avoid free spec work'] }, profile), true)
  assert.equal(hasUnsavedProfileChanges(profile, profile), false)
})

test('onboarding and Settings share the new profile UI without changing save handlers', () => {
  const onboarding = readFileSync(join(__dirname, '../src/components/Onboarding.jsx'), 'utf8')
  const app = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8')
  const stepper = readFileSync(join(__dirname, '../src/components/OnboardingProgress.jsx'), 'utf8')
  const snapshot = readFileSync(join(__dirname, '../src/components/ProfileSnapshot.jsx'), 'utf8')
  const css = readFileSync(join(__dirname, '../src/profile-experience-v2.css'), 'utf8')
  assert(onboarding.includes('<OnboardingProgress'))
  assert(onboarding.includes('<ProfileSnapshot'))
  assert(app.includes('<ProfileSnapshot'))
  assert(stepper.includes('aria-current={current ? \'step\' : undefined}'))
  assert(stepper.includes('getOnboardingStepMeta(currentStep)'))
  assert(onboarding.includes('onSubmit={handleSave}'))
  assert(onboarding.includes('void saveSearchPreferences()'))
  assert(onboarding.includes('void savePortfolioItem()'))
  assert(onboarding.includes('getProofTypeTip(portfolioForm.proof_type)'))
  assert(onboarding.includes('hint && <span className="onboard-v2-field-hint"'))
  assert(app.includes('void saveBusinessProfile()'))
  assert(app.includes("hasUnsavedProfileChanges(businessProfileForm, businessProfile)"))
  assert(app.includes('Discard your unsaved Business Profile changes?'))
  assert(snapshot.includes('{summary.note}'))
  assert(css.includes('@media(max-width:750px)'))
  assert(css.includes('prefers-reduced-motion'))
})
