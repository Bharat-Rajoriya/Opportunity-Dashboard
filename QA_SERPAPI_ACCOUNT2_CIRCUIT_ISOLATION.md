# SerpApi Account 2 — independent circuit coordination

## Why
Google discovery and company research now both use the n8n credential **SerpApi Opportunity Dashboard 2**. Their provider cooldown lookup and lease RPCs were still keyed to `serpapi`, the record whose 429 came from Account 1. That blocked Account 2 even before it had been tested.

## Database changes already applied
- New circuit key `serpapi_account_2`, without changing the original `serpapi` row.
- A clearly labeled `account_2_verification_pending` sentinel (503 with no actual failure timestamp) enables **one** guarded recovery probe on the first eligible request. It is **not** evidence of a historical Account 2 HTTP error.
- Existing shared generic claim/completion/failure RPCs already operate atomically per provider key, and are reused unchanged.
- `get_provider_health_summary_v1` now reads only the Account 2 circuit after validating the authenticated workspace owner.
- Health returns `recovery_eligible` until a real probe succeeds, and `verified_recently` only if a guarded successful recovery was recorded in the past 24 hours. It does not return credentials, lease tokens, or provider response payloads. A 429 returns cooldown for Account 2 only.

## n8n workflows prepared as drafts (NOT published)
- Collector `lY5Xpce2mg5ABsy1`: draft `d729e16a-eae4-4880-abb3-53e35cc224b3`.
- Research `Q1MQ3Lx1C9ABAdjW`: draft `c4f54099-0d64-45f1-b28d-955392b2daa4`.
- The exact 13 revised node parameters are versioned in `n8n/serpapi-account2/circuit-switch-manifest.json`.
- Every provider lookup, recovery claim, success/failure completion and normal-failure report now uses `serpapi_account_2`. Both search nodes retain Account 2 credentials.
- The original global Account 1 cooldown remains intact, and no user search-profile settings were changed.

## Dashboard
- Account 2 recovery-eligible but unverified appears as **Unavailable** with brief wording.
- `verified_recently` appears as **Recently verified**, not a promise of indefinite availability.
- An active new Account 2 429 still appears **Unavailable**, with no cooldown time displayed.
- Existing Freelancer metrics remain unchanged.

## Validation and release
- Static contract/regression tests check all circuit RPCs, both lookup nodes, workspace permissions, initial probe requirement and status rendering.
- Previously staged shared RPC tests #2648/#2649/#2650 covered successful lease completion, 429 failure, and denied claim using a temporary provider key; those tests did **not** make live SerpApi requests.
- An isolated manual SerpApi Account 2 execution was blocked by host safety checks. **No successful live Account 2 Google response has yet been observed.**
- After PR merge: check no active research/collector runs; publish both exact drafts, verify active version IDs; refresh dashboard (unverified must not display as healthy).
- Then a single authorized Find Opportunities run should perform at most one guarded Google recovery request while Account 2 is in verification-pending status. Observe that a successful provider envelope completes the matching Account 2 lease and dashboard becomes Recently verified. Failed/429 should set only Account 2 cooldown.
- Do not reset either circuit to force a test, and do not call the scheduled all-workspaces workflow directly.

## Rollback
Previous active collector `4f489a35-414e-4717-8c21-9bb1c874b956` and research `5879badc-8fb3-4849-a1ce-5efe87fbf2b2`. Republishing these restores the old shared provider key. Do not drop the new row or remove the generic recovery RPCs. Rollback must be coordinated across both workflows and dashboard status to avoid mismatched provider reporting.
