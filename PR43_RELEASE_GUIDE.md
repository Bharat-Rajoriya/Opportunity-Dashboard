# PR #43 — SerpApi Credential Testing and Coordinated Recovery Activation

## Current state verified 2026-11-05
- GitHub PR #42 was merged into `main`.
- Supabase `provider_recovery_coordination_v2` migration is recorded; service-only RPCs exist.
- `SerpApi Opportunity Dashboard 2` exists in n8n (credential type `serpApi`), but the live Google node still uses `SerpApi - Opportunity Engine`.
- Live collector `Opportunity Collector V1` has SerpApi cooldown logic and retryOnFail=false, but it DOES NOT use the new atomic claim/complete RPCs.
- No calls to the second credential, Google search, or a paid provider were executed for this preparation.

## Free SerpApi credential verification
The SerpApi Account API (`GET https://serpapi.com/account.json`) returns quota, usage, and plan information and is documented to be free of charge. Use an isolated manually-triggered n8n workflow, not the production collector. Authenticate using an n8n credential whose configuration is verified to send `api_key` in the way the Account API expects; never paste the secret in node parameters, GitHub, logs, or ChatGPT. Do not mistake the mere existence of a credential for a successful authentication test.

If the existing `serpApi` credential cannot be used directly by the HTTP Request node for the Account API, configure an appropriate *separate* secure HTTP credential in n8n; do not extract or copy the secret into node code. Check that the account response does not get forwarded into user-facing logs or database rows, because it may echo the API key.

Before any Google search test, verify positive remaining searches, provider approval for the account's use, and choose exactly one search call. Do not use a second account to evade the first account's cooldown or usage restrictions. Prefer no paid search during initial plumbing tests.

## Activation requirements
1. Build an isolated n8n test workflow with a **manual trigger only** and credentials stored in n8n. Do not activate a schedule.
2. Use server-only Supabase RPC `claim_provider_recovery_probe` on the known `serpapi` circuit row, passing provider and execution ID; parse result through `validateLease`. For mock tests, use a temporary test provider, never the live circuit.
3. Guard the Google node behind an explicit `authorized` condition; every error, missing response, expired token, missing query or failed RPC MUST skip the external search.
4. Select **at most one query** before a recovery claim. Use an HTTP timeout of 15 s, less than the 180 s lease. Disable automatic retries and batch fan-out.
5. After a single test response, classify the result, call `complete_provider_recovery_probe` with the exact current lease token, and check the returned boolean. Do not continue to multiple Google queries in the same recovery execution after a successful probe.
6. Write only sanitized `provider_source_call_events` rows from the service role; never record raw response bodies, query strings, API keys or authorization headers.
7. Delete/replace the old `Record SerpApi Google Recovery` direct circuit update when turning on the live protocol. Otherwise it can race with the lease-holder completion.
8. **Do not switch** `Google search` to `SerpApi Opportunity Dashboard 2` as part of the lease activation. Keep credential selection and recovery mechanism independent. The provider-wide circuit applies to every credential unless policy explicitly permits a different isolation model.
9. Confirm Freelancer discovery remains unaffected, and no n8n schedules, source preferences, lead scoring, or outreach actions change.

## RPC request bodies (server/service credentials only)

Claim, PostgREST RPC endpoint `/rest/v1/rpc/claim_provider_recovery_probe`:

```json
{"p_provider":"serpapi","p_execution_id":"EXAMPLE-RUN-ID","p_lease_seconds":180}
```

Complete, PostgREST RPC endpoint `/rest/v1/rpc/complete_provider_recovery_probe`:

```json
{"p_provider":"serpapi","p_lease_token":"LEASE-UUID-FROM-CLAIM","p_success":false,"p_failure_code":429}
```

Do not put privileged API keys or tokens in workflow JSON exports. Use backend credential references. Calling the RPC with ordinary authenticated/anon credentials must fail by design.

## Acceptance gates before publishing the n8n collector
- [ ] Claim denied during cooldown, no provider request.
- [ ] Two concurrent claimers: only one can obtain the lease.
- [ ] Wrong, expired and duplicate completion tokens rejected.
- [ ] Missing RPC credential/HTTP failure -> zero Google calls.
- [ ] One query only, no retries, HTTP timeout < lease.
- [ ] Free Account API verified using second credential without revealing secrets.
- [ ] Separate working/rejected outcomes and zero candidate results.
- [ ] No accidental release of raw provider response to users.
- [ ] No change to scheduled production collector until staged tests pass.
- [ ] Confirm n8n active/published graph is the graph that was reviewed.

## Notes
This is a safe implementation package and dry-run contract, **not an activated production integration**. The recovery helper and tests are committed to PR #43. The production n8n collector is still unchanged. The standard CI test script includes the ESM recovery tests, but their passing does not constitute an end-to-end n8n credential or provider API verification.
