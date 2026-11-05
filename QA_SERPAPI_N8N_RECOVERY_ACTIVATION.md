# SerpApi Recovery Coordination — n8n Production Activation

## Deployed and verified (2026-11-05)

- n8n collector: `Opportunity Collector  V1` — workflow `lY5Xpce2mg5ABsy1`.
- Published active version: `477d7702-cd35-4f95-a4bf-7840826d7fdd`.
- Prior published rollback version: `63aeb131-2416-40b8-a0c7-851ca91d2c45`.
- Existing `SerpApi - Opportunity Engine` credential remains on the Google search node. The secondary credential `SerpApi Opportunity Dashboard 2` remains untested/unassigned.
- No live Google API search or paid discovery request was triggered during deployment.
- Supabase `provider_recovery_coordination_v2` and `provider_failure_guard_v1` already deployed. This repo migration mirrors the latter as an idempotent `CREATE OR REPLACE` function.

## Recovery flow

1. `Google Source Enabled` reads the current provider cooldown, requires Google enabled, and when `last_failure_code != 0`, selects **at most one** query and marks `_serpapi_recovery_needed`.
2. `SerpApi Recovery Lease Required?` sends healthy searches through unchanged normal discovery; recovery goes to `Claim SerpApi Recovery Lease` (service-only Supabase RPC, 180 seconds).
3. `Authorize One SerpApi Probe` refuses missing/denied/malformed/expired leases and any query without an explicit recovery flag. A refused claim causes **zero Google requests**.
4. `Google search` remains the original SerpApi credential with `retryOnFail=false`.
5. `Annotate SerpApi Response With Lease` binds a token only when execution ID, workspace ID, query, recovery flag, and token expiry match the originating item. Malformed provider results are not treated as successful recovery.
6. Successful recovery completes `complete_provider_recovery_probe` with the matching token and only then sends results to `Validate Source Domain`. Failure completes the same RPC with error status and ends the probe.
7. Ordinary Google failures call `record_provider_failure_if_unleased`. This service-only RPC will **not update provider cooldown while an unexpired recovery lease is held**.
8. Both legacy direct-write nodes (`Record SerpApi Google Recovery` and `Record SerpApi Cooldown (Google)`) were removed from the active graph.
9. Freelancer source branch, query rotation, scoring, existing opportunities and manual outreach were not changed.

## Verified without paid searches

- Standalone manual decision test: `URTA8HjcphvZ4ZAt`, execution `2594`: 5/5 mock decisions passed, zero provider calls.
- Supabase RPC credential + claim/complete: `1Cz7riynbntb6Au4`, execution `2596`: valid claim, verified token, completion true.
- Exact production draft authorization, annotation, and completion scripts through temporary-provider mock workflow `d3TgORoocG2ObuWF`:
  - Execution `2597`: mock successful provider envelope, completion true, correct token and original response preserved, zero SerpApi calls.
  - Execution `2598`: mock HTTP 429, failure completion true, cooldown 24 hours, zero SerpApi calls.
- Database guarded-normal-failure transaction verified that an active lease prevents a competing cooldown write; absent lease permits 429 cooldown.
- Temporary provider test row deleted.
- Draft/published version IDs verified identical after publishing.

## Remaining risks and follow-up

- **No live paid provider test has been executed**, so the actual SerpApi node's response metadata, billing, and the original credential's current quota are not yet end-to-end verified.
- `provider_source_call_events` schema exists but is not yet populated by this release. Add sanitized telemetry in the next controlled change.
- The lease coordinates post-failure probes; it is **not** a full global healthy-traffic rate limiter. Previously in-flight requests may still finish during a provider outage, but the guarded normal-failure RPC prevents them from overwriting an active lease.
- Provider credential #2 is not a quota-bypass or automatic fallback. Check account limits and service terms before any testing or routing.
- Monitor next explicitly requested discovery run: one recovery probe maximum on expired circuit, no retries, and Freelancer independent.
- Existing canvas warnings concerning disconnected legacy nodes and an OpenAI parameter predate this change; no newly blocking graph validation errors were returned.

## Rollback

If the collector misbehaves, republish previous version
`63aeb131-2416-40b8-a0c7-851ca91d2c45`
from n8n version history and verify `activeVersionId`. This restores the older behavior (including its known non-atomic recovery weakness); keep the new database RPC and migration deployed because they are inert unless called. Avoid blindly rerunning searches or resetting the 429 cooldown. The earlier version should be used only as a short-term rollback while fixing the new workflow.

Do not expose Supabase service role credentials or provider API keys to frontend code or exported workflow JSON.
