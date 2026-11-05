// Advisory-only guidance. Deliberately no automatic retries, provider calls,
// database writes or guesses about which provider caused a generic HTTP error.
const GUIDANCE = Object.freeze({
  quota: {
    category: 'quota',
    title: 'Credits or quota limit recorded',
    action: 'Review the affected provider plan and billing before resuming that source.',
    retry: 'Do not retry until the quota or credits are confirmed available.',
    safeToAutoRetry: false,
  },
  rate_limit: {
    category: 'rate_limit',
    title: 'Rate limit recorded',
    action: 'Keep the affected source on cooldown. Wait for the provider reset or a scheduled, bounded recovery probe.',
    retry: 'Avoid repeated manual searches; HTTP 429 does not prove monthly quota exhaustion.',
    safeToAutoRetry: false,
  },
  authorization: {
    category: 'authorization',
    title: 'Authentication or permission issue',
    action: 'Inspect the affected backend credential and provider permissions in the secure server environment.',
    retry: 'Do not retry automatically until credentials are fixed.',
    safeToAutoRetry: false,
  },
  network: {
    category: 'network',
    title: 'Temporary connection failure',
    action: 'Verify provider/network health first, then manually rerun once if appropriate.',
    retry: 'Do not fan out duplicate requests during an incident.',
    safeToAutoRetry: false,
  },
  upstream: {
    category: 'upstream',
    title: 'Provider service error',
    action: 'Check provider status and defer collection until service health is restored.',
    retry: 'Prefer a controlled manual probe rather than unrestricted retries.',
    safeToAutoRetry: false,
  },
  execution: {
    category: 'execution',
    title: 'Workflow failure',
    action: 'Inspect the named failed n8n step and its execution log before retrying.',
    retry: 'Do not assume the source API was at fault.',
    safeToAutoRetry: false,
  },
})

export function getSourceRecoveryGuidance(run) {
  if (!run || run.status !== 'failed') return null
  const base = GUIDANCE[run.category] || GUIDANCE.execution
  // A failed collector can involve different sources; this label is deliberately
  // non-attributive unless a provider-specific telemetry event exists.
  return {
    ...base,
    failedStep: String(run.failedStep || ''),
    attribution: 'Affected provider not verified from this execution record.',
  }
}

export function sourceRecoverySummary(runs = []) {
  const failures = runs.filter(run => run.status === 'failed')
  const byCategory = Object.fromEntries(
    Object.keys(GUIDANCE).map(category => [category, failures.filter(run => (run.category || 'execution') === category).length])
  )
  return {
    failedRuns: failures.length,
    byCategory,
    actionable: failures.map(run => ({
      executionId: run.executionId,
      startedAt: run.startedAt,
      ...getSourceRecoveryGuidance(run),
    })),
  }
}

// Google SerpApi recovery is implemented in the collector, not this UI:
// - 429 records a 24-hour cooldown in external_provider_circuits.
// - While cooling down, Google search requests are skipped.
// - After cooldown, one query per collector invocation probes recovery.
// - A successful probe clears failure status; a failed probe refreshes cooldown.
// These existing safeguards do NOT enforce one probe globally across concurrent
// executions. PR #40 deliberately does not claim such coordination.
