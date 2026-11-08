# PR #75 — Production Validation & Reliability Audit

## Verified at audit time

- PR #74 is merged into `main`. At audit start GitHub reported no open PRs.
- Recent n8n runs show an orchestrator execution and its collector,
  enrichment, final scoring and pitch sub-workflows completing successfully.
  This is **workflow completion**, not proof that every opportunity is qualified.
- Supabase `manual_capture_reviews` had **zero rows**. No authenticated
  capture-to-provider-verification end-to-end run can be claimed.
- The production `qualify-manual-capture` Edge Function was **version 1** from
  PR #71, missing PR #72's stricter classification validator, despite `main`
  containing it. This was a confirmed code/deployment drift.
- Re-deployed the exact `main` source as Edge version **2**, with JWT
  verification on. Retrieved the live function and confirmed its `index.ts`
  byte-for-byte identical to `main` after deployment.
- The existing `verify-manual-freelancer-source` function is active, JWT
  protected; the n8n official Freelancer adapter is published. It has no
  genuine end-to-end manual verification execution yet.
- The PR #73 and PR #74 Supabase migrations have been applied.

## Confirmed application defects fixed in this PR

1. A successful qualification queue handoff displayed the stale message
   "Automated qualification is not yet connected", misleading users after
   PR #71. Changed the confirmation and success notice to distinguish
   queuing from an explicit AI run.
2. The UI offered a Dismiss/Restore action on completed or otherwise
   machine-controlled captures; the database rejects this transition.
   Restricted the control to `needs_review` and `dismissed`.
3. Added targeted regression checks for the strictly validated worker
   contract, valid UI transitions, and no unverified score or outreach
   upgrades.

## Deployment parity procedure (release gate)

GitHub CI checking static files does **not** assert deployed Supabase code
matches the branch. For each release:

1. Retrieve the active Supabase Edge function's deployed `index.ts` from the
   authenticated project (not from the local repo).
2. Save it to a temporary file outside the repository.
3. Run `node scripts/check-edge-parity.mjs qualify-manual-capture /path/to/live/index.ts`
   and repeat for `verify-manual-freelancer-source`.
4. Confirm both produce `MATCH` and the Edge functions have
   `verify_jwt=true`. Do not copy credentials or user data into the repo.
5. Repeat after deployment if code changes. An offline checker cannot
   automatically access Supabase; a genuine live export is required.

## Remaining explicit manual validation

Before declaring end-to-end production readiness, use a real signed-in
workspace owner to create a Quick Capture, submit, run qualification, inspect
the resulting status and opportunity, and (on supported numeric-ID Freelancer
links) check provider listing evidence. Verify a non-buyer rejection, duplicate
link, failed AI/provider result, insufficient business services, and a
different workspace's denied access.

These checks were **not** performed: production had zero captured items at
audit time, and generating fake leads against a user workspace would alter
real data and incur model cost.

## Follow-up concerns (not broadened into this PR)

- Supabase security advisor flagged authenticated SECURITY DEFINER RPCs.
  Authorization checks exist in the manual review RPC; inspect all three
  functions' grants and policies in the dedicated security phase.
  Guidance: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Historical engine runs include failures; recent successful n8n runs
  do not explain every historical failure. Detailed failure categorization
  and performance tuning should be scoped to a separate reliability PR.
- The Freelancer verifier currently supports numeric-ID URL forms only.
  Slug-only URLs require a provider-specific resolution strategy, not
  an arbitrary user-URL fetch.
- Review rate limits, source data freshness, and API/provider exceptions
  in a later dedicated verification hardening phase.

## Safety and rollback

This PR does not add UI controls or run new AI acquisition tasks, contact
prospects, change scores, or modify user records. The worker re-deployment
restores the already-merged PR #72 validation logic. If required, redeploy the
previous audited function artifact; do not weaken the qualification gate
without investigating the root cause.
