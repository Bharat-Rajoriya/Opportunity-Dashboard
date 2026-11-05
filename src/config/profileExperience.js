/**
 * Presentation-only onboarding and business profile helpers.
 * This UI does not score leads, verify claims, or change saved profile data.
 */
export const ONBOARDING_STEPS = Object.freeze([
  { id: 1, title: 'Business', subtitle: 'Who you are', description: 'Add your business identity, base country, working languages, and the main goal of finding buyers.', tip: 'Write the outcome you want to deliver, not only a list of skills.' },
  { id: 2, title: 'Services', subtitle: 'What you offer', description: 'Describe services your clients can hire you for, with their scope and minimum value.', tip: 'Specific services with real buyer problems help distinguish exact matches from related requests.' },
  { id: 3, title: 'Ideal Buyers', subtitle: 'Who to target', description: 'Define client types, qualification criteria, and requests you want to avoid.', tip: 'Target preferences guide the search, but do not guarantee a lead is qualified.' },
  { id: 4, title: 'Discovery', subtitle: 'How to search', description: 'Choose allowed discovery sources, freshness and buyer-intent thresholds.', tip: 'Selecting a source does not guarantee that provider is connected, available, or within quota.' },
  { id: 5, title: 'Proof', subtitle: 'Show your work', description: 'Optionally add genuine portfolio links, profiles, projects, or reviews.', tip: 'Only include claims and results that you can substantiate. You can add proof later.' },
])

const nonEmpty = value => typeof value === 'string' && Boolean(value.trim())
const itemsPresent = value => Array.isArray(value) && value.some(item => nonEmpty(item))
const activeItems = value => Array.isArray(value)
  ? value.filter(item => item && item.active !== false).length : 0

export function getOnboardingStepMeta(step) {
  return ONBOARDING_STEPS.find(item => item.id === step) || ONBOARDING_STEPS[0]
}

export function getProfileOverview(profile = {}, services = [], proofs = [], options = {}) {
  const essentials = [
    { id: 'identity', label: 'Business identity', ready: nonEmpty(profile?.business_name) && nonEmpty(profile?.business_type), suggestion: 'Add your business name and type in Business Profile.' },
    { id: 'goal', label: 'Buyer-focused goal', ready: nonEmpty(profile?.primary_goal), suggestion: 'Describe the buyer requests you want to find.' },
    { id: 'services', label: 'Active services', ready: activeItems(services) > 0, loading: options.servicesLoading === true, suggestion: 'Add an active service with clear scope and minimum project value.' },
    { id: 'languages', label: 'Working location & languages', ready: nonEmpty(profile?.provider_country) && (itemsPresent(profile?.working_languages) || nonEmpty(profile?.preferred_language)), suggestion: 'Add your base country and working languages. This does not block international opportunities.' },
  ]
  const optional = [
    { id: 'targeting', label: 'Ideal buyer preferences', ready: itemsPresent(profile?.ideal_client_types) || nonEmpty(profile?.good_opportunity_definition), suggestion: 'Add client types and a good-opportunity description.' },
    { id: 'proof', label: 'Proof of work', ready: activeItems(proofs) > 0, loading: options.proofsLoading === true, suggestion: 'Add a real portfolio, project or testimonial link when available.' },
  ]
  const known = essentials.filter(item => !item.loading)
  const completed = known.filter(item => item.ready).length
  const total = essentials.length
  const pending = essentials.some(item => item.loading)
  return {
    essentials,
    optional,
    completed,
    total,
    pending,
    // This count is the presence of setup inputs; it is never a reliability or lead-quality score.
    note: 'Setup checklist only. It does not verify your claims or predict lead quality.',
    activeServiceCount: activeItems(services),
    activeProofCount: activeItems(proofs),
  }
}

export function getProofTypeTip(type) {
  const tips = {
    profile: 'Use a real portfolio or professional profile URL that shows your relevant work. You do not need a platform integration.',
    project: 'Describe the scope you delivered and link to a real work sample when possible.',
    case_study: 'Explain the challenge, your contribution, and a verifiable outcome.',
    publication: 'Link to a published article or resource that shows your expertise.',
    testimonial: 'Use a genuine client statement or review; avoid invented endorsements.',
    certification: 'Add a valid credential and awarding organization if available.',
    other: 'Provide truthful evidence and enough context for a buyer to understand it.',
  }
  return tips[type] || tips.other
}
