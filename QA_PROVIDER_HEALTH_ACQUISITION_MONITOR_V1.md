# Provider Health & Acquisition Monitoring V1

## Scope
Dashboard overview includes a source monitor distinguishing:
- **Selected/configured** in the active search profile
- **Actually evaluated** in the latest engine run (workspace events)
- **Evaluated and created** in the past 30 days (existing source analytics)
- **Shared Google/SerpApi circuit** state based on a secure RPC

Sources are Google, Freelancer, Upwork (unverified unless integration evidence exists), and any future selected source.

## Security
Production migration `provider_health_summary_v1` applied and committed as `20261106230000_provider_health_summary_v1.sql`.
- `public.get_provider_health_summary_v1(p_workspace_id uuid)` validates the authenticated caller owns an *active* workspace.
- The `security definer` function has a fixed empty search path and uses explicit schema references. It is executable only by `authenticated` (and privileged roles), not `anon` or `PUBLIC`.
- Returns sanitized `provider`, `state`, `cooldown_until` **only for active cooldowns**, `checked_at`; no API key, lease token, probe execution ID, failure text, or live per-account quota.
- A call without an authenticated workspace was tested and returned `42501 Workspace access denied`. Database grants were verified: anon execute=false, authenticated execute=true.
- The Google circuit is **shared between collector and research**, even though research uses Account 2; this panel never claims Account 2 has spare quota.

## Data consistency
- Source analytics use a 30-day sliding window via existing `fetchSourceAnalytics` and workspace RLS.
- Latest run counts use `source_candidate_events` limited to workspace and `master_execution_id`; event types are counted separately.
- A selected source with no evaluated events is `selected — collection unverified`.
- Freelancer with evaluated items in the latest run is `collected in latest run`, not a continuous uptime signal.
- Google with 429 cooldown is `temporarily unavailable`, even if it produced older results.
- A cooldown that has elapsed becomes `recovery eligible — not verified` until a real successful provider response is observed.
- Unknown provider state and failed monitoring fetches show an uncertainty message, never a green badge.
- The interface does not expose provider credentials or offer a button that sends a paid search.
- Manual `Refresh status`, workspace switching, or completed engine run update UI data without triggering discovery.

## Production verification
Inspect the dashboard under the current logged-in user's own workspace. Confirm the Google state reflects the shared circuit and Freelancer recent counts match source events; test another account to ensure no cross-workspace source analytics are visible. Verify responsive layout and empty states. Real provider quota is not probed.

## Caveats
- The panel summarizes available backend records, not real-time provider SLA, hourly uptime, or remaining quota.
- The last-run candidate-event query is limited to 2,000 rows; large runs would need paginated aggregation.
- The provider-status RPC is a global circuit summary exposed only after workspace ownership verification; it never discloses per-account provider details.
- No change was made to n8n discovery, research, scoring, or source credentials.
