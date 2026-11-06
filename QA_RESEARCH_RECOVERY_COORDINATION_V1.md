# Research Recovery Coordination V1 — controlled production rollout

## Scope
n8n workflow: Opportunity Enrichment - V1 (`Q1MQ3Lx1C9ABAdjW`).

Original published version: `5f59fbc1-6403-4100-b1c8-1a7a5982429e`.
Prepared draft version: `0b939ac0-1a53-4d50-85be-57ae43df2130` (not yet published when this file was authored).

The research workflow and main opportunity collector share a single Supabase `external_provider_circuits` row for provider `serpapi`. They must share the **same** recovery lease, not create independent provider-state or quota overrides.

## Guardrail implementation
- `Can Research Company?` permits healthy provider requests when a real company research query exists. During failure it waits for cooldown and prevents another recovery attempt after any earlier claim in the same execution. No new search after a provider error in the same research run.
- `Research Recovery Required?` branches failed-provider research through a shared service-role `claim_provider_recovery_probe` (180-second lease).
- `Authorize Research Recovery Probe` denies malformed grant, missing token, expired lease, absent query or mismatched workspace.
- `Research Probe Authorized?` sends denied requests to source-only `Partial Research`, **not** to `Research Prospect`.
- The existing provider credential `SerpApi - Opportunity Engine` remains unchanged on the real research node; `retryOnFail=false`.
- Validate actual provider response. Recovery success must commit by `complete_provider_recovery_probe` with matching token and confirmed success before it can enter `Build Research Packet`. Incomplete or unsuccessful completion returns to partial research.
- Recovery probe HTTP errors or malformed results complete the lease as failure, preserving quota cooldown.
- Normal research errors use `record_provider_failure_if_unleased`, which cannot overwrite an unexpired competing recovery lease.
- The old direct-write node `Record SerpApi Cooldown (Research)` was removed from the draft.
- Normal research remains dependent on available provider quota. The change does not activate another SerpApi credential, bypass provider limits, auto-retry, or enrich anonymous company details without evidence.

## Isolated staged tests
Test workflow: `ocOV2prbROHb3dJi` (manual-only, inactive). The shared Supabase RPCs used a temporary test provider `serpapi_research_stage_v1`, not the production `serpapi` circuit.

- Execution **#2648**: grant true, token preserved through simulated successful SerpApi response, successful token completion confirmed, complete research packet admitted.
- Execution **#2649**: mock HTTP 429, correct recovery token completed as failed, 24-hour cooldown set, fallback to partial research.
- Execution **#2650**: while provider cooldown active, grant denied, no provider request occurred, partial research used.
- All three tests returned success; **zero real SerpApi calls** were made.
- Temporary test provider row deleted; production `serpapi` provider cooldown and credential preserved.

## Deployment checklist
1. Review and merge PR with source snapshots, graph manifest and regression checks.
2. Verify there are no running parent/collector/research executions.
3. Compare current research draft against `activation-manifest.json`. Credential type should be `supabaseApi` on all recovery HTTP nodes and original `serpApi` on `Research Prospect`.
4. Publish only the reviewed version `0b939ac0-1a53-4d50-85be-57ae43df2130`; immediately verify its `activeVersionId`.
5. Do **not** force a provider request or reset cooldown. As of this test, normal SerpApi circuit remained in 429 cooldown until 2026-11-06 11:43:15 UTC (=17:13:15 IST).
6. Observe the next user-triggered acquisition run, confirm research uses partial fallback during cooldown; after provider has quota and cooldown elapsed, confirm a single successful recovery lease/response.
7. Record sanitized provider outcomes in a later telemetry iteration; do not log API keys, raw error bodies, or personal project queries into public tables.

## Rollback
Prior active research version: `5f59fbc1-6403-4100-b1c8-1a7a5982429e`. Republishing it restores old functionality **and its known unsafe direct cooldown writer**; only as an emergency short-lived rollback. Existing service-role Supabase RPCs are shared with the collector and should not be removed.

## Limits
- No paid, real research request was executed in this change.
- The staged path verifies success, 429, and denial, but actual n8n provider search success/failure metadata will need confirmation in future authorized runs.
- An active lease prevents racing cooldown updates; it is not global healthy-state rate limiting.
- `research_status=partial` during a 429 cooldown is expected, not enrichment fabrication or a successful full research result.
