# PR #76 — Manual Capture Security & Stale Recovery

## Verified risks

1. Owners could delete a completed, queued, or in-progress manual capture
   through the table's original DELETE RLS policy, losing its qualification
   trail. The policy now allows deletion only while the capture is in
   `needs_review` or `dismissed`.
2. A run interrupted while status `qualifying` can become stranded after
   its 180-second claim lease expires. It cannot safely be finalized later
   and should not incur additional AI spend implicitly.

## Explicit recovery workflow

1. An owner refreshes Quick Capture. The **Resolve stalled run** action
   appears only when a qualifying capture's start timestamp is more than
   180 seconds old.
2. A confirmation warns that this will not re-run AI or create leads.
3. JWT-protected Edge Function `recover-stalled-manual-capture` verifies
   the signed-in user's workspace through RLS and capture identity.
4. A service-role-only SQL RPC independently validates workspace owner,
   `active=true`, `qualifying` status, and elapsed processing window.
   Row-level locking serializes recovery against concurrent finalization.
5. If eligible, the status changes to `failed`, lease clears and the reason
   is recorded. Attempt count, opportunity records and outreach are unchanged.
   No automatic retry is scheduled. The user's earlier paid model call
   cannot be recovered or refunded by this action.

## Security boundary audit

The existing three warning-level `SECURITY DEFINER` RPCs were inspected:
`submit_manual_capture_for_qualification`,
`record_manual_capture_source_review`, and
`get_provider_health_summary_v1`. All verify `auth.uid()` and workspace
ownership, with the health summary also verifying active workspace state.
The elevated execution is deliberate because the machine-managed client
update guard and provider circuit restrictions prevent an ordinary user-role
update/read. This PR does **not** blindly flip those functions to
`SECURITY INVOKER`, which would break the existing access model.

A separate, older two-argument overloaded claim function is already
non-executable by authenticated users and is not called by the Edge worker.
It is noted for later removal only after auditing every dependent caller.

## Deployment / validation

- Apply migration `20261109101000_manual_capture_stale_recovery_guard_v1.sql`.
- Deploy `recover-stalled-manual-capture` with `verify_jwt=true`.
- Run `npm run check`, GitHub CI, and preview checks.
- Confirm policy only permits owner deletion in `needs_review` or `dismissed`.
- Confirm `authenticated` and `anon` cannot EXECUTE the recovery RPC.
- Verify a still-active lease cannot be expired, a different workspace is
  denied, and a successful/failed terminal capture cannot be overwritten.
- A real stale capture cannot be tested without an actual interrupted
  execution; do not manufacture or mutate customer data just to get a green
  validation indicator.

## Remaining concerns

The pre-existing advisor reports an intentional but elevated execution
surface for three RLS-aware functions; these should be monitored and
reviewed as the authorization model evolves. Leaked-password protection
is still disabled. No n8n graphs, scheduled tasks, provider collector,
scoring weights, or outreach policies were changed.
