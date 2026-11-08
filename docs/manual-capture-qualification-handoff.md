# Quick Capture qualification handoff contract

The manual queue is **not** the collector's scored `opportunities` table.

- Workspace user records a public URL, title, and buyer requirement through Quick Capture.
- User explicitly presses **Submit for qualification**, then accepts the confirmation.
- `submit_manual_capture_for_qualification` executes as the authenticated user, verifies workspace ownership, locks the captured row, requires `needs_review`, checks matching source URL within the workspace's existing Opportunities, and moves the capture to `pending_qualification`. Repeating the RPC fails.
- No provider API, AI model, scraper, messaging workflow, or opportunity insertion is triggered by this action.
- The queue exposes `id`, `workspace_id`, `source_url`, `title`, `requirement`, `source_platform`, `submitted_for_qualification_at`. These are manually supplied and **unverified** facts.

## Required future worker behavior (not implemented)

1. Authenticate as trusted server role and claim each queued row atomically with a lease, workspace isolation, retry tracking and idempotency.
2. Fetch only supported public sources through source-specific adapters; protect against SSRF, redirects to private IP ranges, robots/TOS conflicts and closed jobs. Treat input fields as untrusted.
3. Obtain business profile, services, geographic/eligibility preferences and explicit source evidence; translate to the existing classifier's full `discovery_context` contract.
4. Apply the existing intent, service-fit, source-quality, eligibility, freshness, commercial-fit and duplicate gates. Never invent scores or verified identities.
5. Persist only qualified results via the established protected service pipeline, mapping source provenance and linking each result back to the capture. Failed/rejected/stale items should remain auditable with explicit reasons.
6. Keep outreach manual and user-approved. Never send emails automatically.

**Operational status:** The qualification worker has not been wired. A `pending_qualification` status means approved for a *future* review/processing run, not presently processing.
