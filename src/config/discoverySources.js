/**
 * Discovery sources are user-selectable. The direct Freelancer collector
 * is only offered once its production capability is enabled.
 */
export function defaultDiscoverySources(freelancerAvailable) {
  return freelancerAvailable ? ['google', 'freelancer'] : ['google']
}

export function shouldSuggestFreelancer({
  freelancerAvailable,
  enabledSources,
  opportunityCount,
  loading,
} = {}) {
  return Boolean(
    freelancerAvailable &&
    !loading &&
    opportunityCount === 0 &&
    Array.isArray(enabledSources) &&
    enabledSources.includes('google') &&
    !enabledSources.includes('freelancer')
  )
}

export function toggleOnboardingSource(sources, source, enabled, freelancerAvailable) {
  const available = freelancerAvailable
    ? ['google', 'freelancer']
    : ['google']
  const current = Array.isArray(sources) ? sources : []
  const next = enabled
    ? [...current, source]
    : current.filter((key) => key !== source)

  return available.filter((key) => next.includes(key))
}
