# Provider monitor — persisted latest-run fix

## Observed after PR #50
Authenticated dashboard screenshot shows Google correctly in SerpApi cooldown but:
- `Latest run evaluated = 0` across all sources,
- `Latest run new = 0`,
- `No completed run timestamp is available`.

This is misleading. The last persisted workspace engine run (#2661) evaluated **30 Freelancer candidates** and created **1 opportunity**, with 2 qualified and 1 duplicate. Historical 30-day counts were already displayed.

## Root cause
`engineRun` is React state populated only by the current browser's `Find Opportunities` completion/polling. On a fresh page load or refresh, the provider component received `engineRun=null` and the provider counter query received no execution ID.

## Fix
`loadProviderMonitor(workspaceId)` now independently calls the existing RLS-scoped `getLatestEngineRun(workspaceId)`. It stores the persisted record for the monitor and fetches `source_candidate_events` using its real `master_execution_id`. It retains workspace-load and request-ID protections so stale responses cannot cross workspace switches. The monitor refresh button and completed-run effect both reload this persisted state.

## Validation
- Test assertions cover first load, manual refresh, completed discovery, newest-run selection, workspace scoping and avoiding paid searches.
- Verify after PR merge: refreshed dashboard should show the last run and **Freelancer latest run 30 evaluated / 1 created** for the confirmed workspace as of run #2661 (unless a newer run has subsequently occurred).
- Google remains cooldown; an empty latest-run Google count is correct because no Google candidates were evaluated on that run.
- If the latest run is absent or the events query errors, show neutral status/error, not a fabricated healthy state.
- This patch does not change n8n, provider credentials, Supabase schema, quota or cooldown.
