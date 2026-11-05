# Source Reliability & Recovery V1 — operational contract

## Verified baseline (2026-11-05)
The active Opportunity Collector already uses a shared service-role-only `external_provider_circuits` row for `serpapi`.

Existing n8n paths:
1. **Get SerpApi Circuit (Google)** reads the row; missing/unparseable cooldown fails closed.
2. **Google Source Enabled** skips Google requests during cooldown, preserves user settings, and emits at most one query **per collector invocation** after a 429 cooldown expires.
3. **Google search** has `retryOnFail: false`, `onError: continueRegularOutput`; errors reach **Google SerpApi Response OK?**.
4. **Record SerpApi Cooldown (Google)** records 24h for suspected 429/quota; 15min for other failures. A successful recovery probe clears the failure marker through **SerpApi Google Recovery Probe?**.
5. Freelancer collection is a separate enabled source. A Google cooldown must never disable it.

The existing row's last recorded code was HTTP 429, with its next cooldown expiry stored in UTC. HTTP 429 is *rate limiting*, not conclusive proof of depleted monthly credits.

## What this PR does
- Add user-facing, read-only recovery guidance alongside run health, using workspace-owned `engine_runs` records.
- Display distinct actions for explicit quota, 429/rate limit, credential, network, upstream and generic failures.
- Keep all automatic retries disabled from the dashboard.
- Never display raw backend provider error strings, credentials or private circuit details in the browser.
- Preserve existing collector controls, scoring, source preferences and manual outreach.

## Known reliability risks — do not misrepresent as solved
1. **Global probe concurrency:** Google probe limiting is per collector execution, not an atomic global lease across simultaneous workspaces. A future migration + server-side claim mechanism is required to enforce one global probe at a time.
2. **Partial batch errors:** If several Google queries are already queued and one emits HTTP 429, other in-flight queries may still complete. The existing circuit protects later runs, not necessarily this batch.
3. **Provider attribution:** A failed orchestrator step may involve Google, Freelancer, LLM or database activity; `failed_step` alone does not identify the exact failing external provider.
4. **Unhandled provider failures:** The reporting views observe persisted events and engine logs, not every HTTP request.
5. **No credential exposure:** The restricted `external_provider_circuits` table must remain service-role-only. Don't expose it via an unrestricted view or frontend client.

## Acceptance checks
- [ ] CI: lint, test and build succeed.
- [ ] Account A cannot see Account B's run logs (existing `engine_runs` owner RLS remains active).
- [ ] No additional provider API requests, background retries or source enablement are introduced.
- [ ] A recorded 429 suggests cooldown rather than billing reset.
- [ ] An explicitly recorded quota-exhausted failure suggests checking plan/credits.
- [ ] A zero-candidate completed run is **not** treated as an API outage.
- [ ] Verify desktop and 320px/375px/768px responsive views.
- [ ] Verify Google still obeys cooldown in a controlled n8n test, with no paid production API requests.

## Recommended V2 backend change
Implement an atomic, service-role-only provider probe lease, bounded source concurrency, and a dedicated source-call event record (request outcome, error category, timestamp and run ID). This requires staged testing of n8n nodes and careful cost budgeting before activation. Do not silently turn retries on.
