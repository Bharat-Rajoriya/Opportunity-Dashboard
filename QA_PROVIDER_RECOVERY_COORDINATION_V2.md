# Provider Recovery Coordination V2 — staged backend rollout

## Scope and current deployment state
This PR adds an **inert**, database-backed probe lease and structured provider request telemetry. It does not alter the active n8n collector, the frontend, Google/SerpApi call volume, Freelancer, scoring, or outreach. **Do not claim it already prevents real concurrent API probes before n8n is wired and migration is deployed.**

The existing `external_provider_circuits` service-role-only row for `serpapi` is preserved (cooldown and failure status included). A new `provider_source_call_events` table is also service-role-only (no client access, RLS enabled); requests should log only safe status and category, never keys, raw URLs, payloads, or error bodies.

## API contracts — service_role ONLY

### Claim before recovery request
`POST /rest/v1/rpc/claim_provider_recovery_probe`

Body:
```json
{"p_provider":"serpapi","p_execution_id":"<master_execution_id>","p_lease_seconds":180}
```

An authorized call returns one record with `granted`, `lease_token`, `retry_after`, and `reason`. Only the holder of a true `granted` and its token may perform the **single** probe request. If `granted=false`, skip the provider request entirely; retrying a refused claim is not appropriate within the same engine run.

A `no_recovery_required` result is **not permission to probe**; normal discovery must use the ordinary source enablement and provider budget checks.

### Complete exactly once after the provider response
`POST /rest/v1/rpc/complete_provider_recovery_probe`

Body on success:
```json
{"p_provider":"serpapi","p_lease_token":"<returned UUID>","p_success":true}
```

Body on failure:
```json
{"p_provider":"serpapi","p_lease_token":"<returned UUID>","p_success":false,"p_failure_code":429}
```

A false result means the lease was expired, replaced or already completed: do **not** overwrite another run's current state. A 429 is treated as a rate limit, not proof of exhausted credits. Other errors default to 503 and receive 15 minutes unless an approved policy says otherwise.

**Security:** Use a backend-only Supabase credential with service_role privileges through an n8n credential store (or a securely deployed backend intermediary). Never place it in node text, Webhook responses, browser JS or GitHub. Reject requests on missing/unparseable grants or tokens. Revoke function EXECUTE from PUBLIC/anon/authenticated in SQL.

## Future n8n activation sequence (separate reviewed change, NOT in this PR)
1. Deploy and verify migration in a non-production environment.
2. Add a credential-backed HTTP Request RPC action for **claim**, before the existing `Google search` node's recovery probe path.
3. Restrict the 429/recent-failure path to exactly one selected query before claiming. If claim denied, Google path stops; Freelancer remains unaffected.
4. Store lease token only in temporary n8n execution state. Send exactly one provider request (no node-level retry).
5. On success/failure, call **complete** using the same token; ensure a timeout/error branch also completes or lets the lease expire safely.
6. Replace the old `SerpApi Google Recovery Probe?` / `Record SerpApi Google Recovery` direct writes so they cannot race with token ownership. Preserve 24h / 15min cooldown policy.
7. Log a sanitized provider-call event (provider, source, workspace, run ID, outcome, HTTP status, category) server-side only.
8. Verify two simultaneous workspaces compete for one probe, and one denied claimant issues **zero provider requests**.
9. Verify no increase in paid requests, and rollback n8n changes if call-budget guard fails.

## Important concurrency limitations
- The lease claim is atomic and per provider because the UPDATE locks its row, but n8n must actually call it for the guarantee to apply.
- A 180s lease is not a universal upper bound for provider request duration; enforce an HTTP timeout shorter than the lease. Otherwise the lease may expire while a request remains in flight and another probe may start.
- Existing Google fan-out after a healthy response is separate from **recovery probes**. A probe lock is not a general rate limiter or a daily quota policy.
- Existing legacy direct circuit updates can overwrite the probe's status unless retired during n8n activation.
- If network fails between external response and completion, the lease expires and allows a future attempt after expiry. Do not add blind retries.
- Provider-wide locks cannot identify which workspace owns a source request unless the n8n caller preserves execution context.

## Security and atomicity verification after deploying migration

Use a **staging** Supabase project. Execute in a single transaction and ROLLBACK; never use a real provider's row for testing:
```sql
begin;
set local role service_role;
insert into public.external_provider_circuits(provider, cooldown_until, last_failure_code, updated_at)
values ('v2_test_provider', now() - interval '1 hour', 429, now());

select * from public.claim_provider_recovery_probe('v2_test_provider','execution-A',180);
-- Save the returned token in the test harness. A second claim must return granted=false.
select * from public.claim_provider_recovery_probe('v2_test_provider','execution-B',180);
-- Completing with a different token must return false.
select public.complete_provider_recovery_probe('v2_test_provider', gen_random_uuid(),true);
-- Complete with the saved token must return true; a duplicate call must return false.
rollback;
```

Additional mandatory integration checks:
- Claim during cooldown => denied.
- Missing provider row => denied.
- Expired lease => another claimant may take over.
- An old token can't complete a new claimant's lease.
- Successful completion clears failure code; 429 refreshes cooldown.
- `SET LOCAL ROLE authenticated` and `anon` must both fail to execute RPCs and read/write the provider table/event log.
- Normal runs must not claim a probe after recovery completes.
- Verify RLS and grants, plus CI and controlled n8n execution logs, before enabling production.

## Release sequencing
1. Merge PR #42 after review.
2. Deploy the schema migration and run staging security/concurrency checks.
3. Wire the active n8n collector in a separate, explicitly reviewed deployment and verify one real low-cost probe only if authorized.
4. Move source-call logging to the backend and add user-safe health aggregation later; never expose service-role-only events directly in the browser.
