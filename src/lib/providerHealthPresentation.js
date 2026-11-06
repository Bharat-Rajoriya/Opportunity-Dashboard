const SOURCE_NAMES = {
  google: 'Google Search',
  freelancer: 'Freelancer',
  upwork: 'Upwork',
}

export function interpretSerpApiHealth(payload, now = Date.now()) {
  const state = String(payload?.state || 'unknown')
  const until = payload?.cooldown_until || null
  const expires = until ? Date.parse(until) : NaN
  if (state === 'cooldown' && Number.isFinite(expires) && expires > now) {
    return {
      state: 'cooldown',
      label: 'Temporarily unavailable',
      detail: 'Search provider is rate-limited. Automatic recovery will be eligible after the cooldown.',
      cooldownUntil: until,
    }
  }
  if (state === 'cooldown' || state === 'recovery_eligible') {
    return {
      state: 'recovery_eligible',
      label: 'Recovery eligible — not verified',
      detail: 'The cooldown has elapsed, but a successful provider response has not been confirmed.',
      cooldownUntil: null,
    }
  }
  if (state === 'recovery_in_progress') {
    return {
      state: 'recovery_in_progress',
      label: 'Recovery check in progress',
      detail: 'A guarded provider probe is currently in progress. Availability is not yet confirmed.',
      cooldownUntil: null,
    }
  }
  if (state === 'availability_unverified') {
    return {
      state: 'availability_unverified',
      label: 'Available status not verified',
      detail: 'No active cooldown is recorded. This does not confirm remaining quota or a successful search.',
      cooldownUntil: null,
    }
  }
  return {
    state: 'unknown',
    label: 'Status unavailable',
    detail: 'Provider availability could not be confirmed from the available monitoring data.',
    cooldownUntil: null,
  }
}

export function buildProviderMonitorRows({
  enabledSources = [],
  providerHealth = null,
  sourceAnalytics = {},
  latestRunCounts = {},
  now = Date.now(),
} = {}) {
  const enabled = new Set((Array.isArray(enabledSources) ? enabledSources : []).map(v => String(v).toLowerCase()))
  const known = ['google', 'freelancer', 'upwork']
  const sources = [...new Set([...known, ...enabled])]
  const serp = interpretSerpApiHealth(providerHealth, now)

  return sources.map(source => {
    const sourceEnabled = enabled.has(source)
    const historical = sourceAnalytics?.[source] || {}
    const latest = latestRunCounts?.[source] || {}
    const evaluated30d = Math.max(0, Number(historical.evaluated) || 0)
    const created30d = Math.max(0, Number(historical.created) || 0)
    const latestEvaluated = Math.max(0, Number(latest.evaluated) || 0)
    const latestCreated = Math.max(0, Number(latest.created) || 0)
    let state = 'not_configured'
    let label = 'Not selected'
    let explanation = 'This source is not selected in the active search profile.'

    if (sourceEnabled && source === 'google') {
      state = serp.state
      label = serp.label
      explanation = serp.detail
    } else if (sourceEnabled && source === 'freelancer') {
      if (latestEvaluated > 0) {
        state = 'collected_in_latest_run'
        label = 'Collected in latest run'
        explanation = 'Recent project candidates were actually evaluated through Freelancer. This is not a continuous uptime check.'
      } else if (evaluated30d > 0) {
        state = 'recent_historical_activity'
        label = 'Activity in last 30 days'
        explanation = 'Freelancer candidates were evaluated recently, but not in the latest recorded run.'
      } else {
        state = 'configured_unverified'
        label = 'Selected — collection unverified'
        explanation = 'This source is selected, but no evaluated candidates were recorded in the monitoring period.'
      }
    } else if (sourceEnabled) {
      state = 'integration_unverified'
      label = 'Selected — integration unverified'
      explanation = 'Selecting a platform does not confirm that its connector is authorized or returning results.'
    }

    return {
      source,
      name: SOURCE_NAMES[source] || source,
      enabled: sourceEnabled,
      state,
      label,
      explanation,
      cooldownUntil: source === 'google' && sourceEnabled ? serp.cooldownUntil : null,
      evaluated30d,
      created30d,
      latestEvaluated,
      latestCreated,
      latestQualified: Math.max(0, Number(latest.qualified) || 0),
      latestDuplicates: Math.max(0, Number(latest.duplicate) || 0),
    }
  })
}

