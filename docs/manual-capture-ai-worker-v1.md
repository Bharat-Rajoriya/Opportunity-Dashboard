# Manual Capture AI Qualification Worker — PR #71

## What is working

1. A signed-in workspace owner first creates a Quick Capture and explicitly submits it for qualification (PR #70).
2. The user deliberately selects **Run AI qualification** on a pending item. This is an on-demand paid-model call, never an automatic background run.
3. Supabase Edge Function `qualify-manual-capture` requires a valid user JWT, verifies the workspace and queued capture using the user's RLS client, loads the current business profile and active services, then atomically claims the capture via a **service-role-only** SQL RPC.
4. The server posts the unverified title, description, URL and business/service context to the header-authenticated n8n classifier `oGf3mgpyehCrZx1p`. It uses the same protected n8n header credential as the production opportunity engine. The classifier does not read/write the database or contact a source.
5. The server validates response types and capture identity, then calls the service-role-only atomic finalize RPC. An explicit client-facing status is recorded: **qualified**, **rejected**, or **duplicate**. Provider/model failures are marked **failed**, not rejected.
6. Qualified manual candidates are inserted only after service ID, buyer intent, AI confidence, type, rejection, and eligibility checks. The original URL is fingerprinted and workspace deduplication is applied.
7. Accepted opportunities are marked `status='review'`, `recommended_action='research'`, `research_status='partial'`, `score_stage='preliminary'` and score **45/100** (conservative fixed cap); `raw_payload.source_verified=false`. No outreach is generated or sent.

## AI qualification gate

A captured listing must be an explicit buyer request, have intent >=3/4, confidence >=0.75, an exact active service match from **the same workspace**, buyer likelihood strong/moderate, no rejection rule, no explicit eligibility mismatch, and an accepted source result type (buyer_request or marketplace_post). Weak, ambiguous, promotional and full-time-job postings are rejected. AI results **do not independently verify** a page, buyer identity, budget, project freshness, or payment reliability. Do not present the capped score as a final lead-quality score.

## Idempotence and authorization

- Every user action requires workspace membership (owner in current app) and a queued `pending_qualification` record.
- The client cannot write machine-controlled status, results or lease columns directly (row-level trigger).
- The worker claim and finish methods execute as **SECURITY INVOKER**, are granted only to `service_role`, and require correct workspace/lease data. Claim also requires the verified user's ID matching `workspaces.owner_user_id`.
- Only one worker claim may start; a 180-second lease and monotonic attempt count protect duplicate processing. A failed job has a visible terminal failure state, with no automatic retry in V1.
- A unique `(workspace_id,fingerprint)` opportunity index plus URL check helps avoid double insertion. A simultaneous external collector collision may produce a failed capture, not duplicate insert.

## Live verification

- Synthetic n8n manual execution **#2775** succeeded: correctly classified an explicit WooCommerce project as a buyer request, with matched service, 4/4 intent, 0.99 confidence and `source_verified:false`. The execution used a fake workspace/capture and **did not write data**.
- Confirm the *actual authenticated end-to-end* Vercel preview before merging: create Quick Capture → Submit for qualification → Run AI qualification → verify outcome, database record and no outreach. A green GitHub CI or Edge deploy is **not** an end-to-end proof.
- Also verify a non-buyer sample is rejected, duplicate URL is recorded as duplicate, missing active services is reported without consuming the capture, and failed AI calls are recorded as technical errors rather than rejected buyers.

## Configuration

- Supabase Edge Function: `qualify-manual-capture`, JWT verification enabled.
- Requires existing secret `N8N_WEBHOOK_SECRET` already used by the opportunity engine.
- n8n workflow: `https://bharat-2304.app.n8n.cloud/workflow/oGf3mgpyehCrZx1p`
- Protected webhook path: `opportunity-manual-capture-qualification`. Auth header `x-opportunity-engine-key` must match the n8n `Opportunity Engine Internal` header credential. Never put this value in frontend code.
- Source fetching is **not performed**. Only user-supplied text is classified. A supported source-specific verifier should be added in a later phase before permitting higher scores or automatic pitch recommendations.
- No scheduled queue processor, retries, or external provider calls are enabled.

## Rollback

Remove the frontend Run AI qualification action and disable the Edge Function; the queue and existing opportunities remain readable. The new classifier is isolated from master collector and can be unpublished independently. Do not drop database columns without preserving audit data.


## PR #72 — Qualification reliability and source provenance contract

This change hardens the boundary between the private n8n classifier and the
Supabase finalization RPC. HTTP 200 from n8n is **not** evidence that the
classifier output is valid or that the linked source is genuine.

- Validate the entire classifier envelope, including exact capture/workspace
  correlation, 1–4 integer intent, 0–1 confidence, bounded nonempty reason,
  known categorical values, and explicit `source_verified=false`.
- Require `provenance='unverified_manual_text'`; never substitute a page
  verification claim for manually supplied text.
- Match any returned service identifier against the active services loaded
  server-side for this workspace; check that the service-fit label and ID agree.
- Reject contradictory `is_buyer_request=true` with non-buyer source type.
- Invalid or inconsistent results follow the existing worker failure path:
  fail the claimed capture, show a technical failure, create no opportunity,
  and never trigger outreach. There is no hidden retry or extra model call.
- Keep the SQL gate, atomic finalization, deduplication and preliminary score
  unchanged.

### Source verification boundary

PR #72 **does not fetch the linked page**, validate the publisher or prove
current availability. It strengthens provenance enforcement but is not a
source verification implementation. A future source-specific provider adapter
should use official API evidence or safely fetched public content, record
separate evidence and freshness timestamps, and only then consider promotion
from `source_verified=false`. Avoid generic URL fetches from user input
without SSRF, redirect, content-size and host protections.

### Validation checklist

Run `npm run check`; manually submit a real buyer request and a promotional
page; verify malformed classifier responses are marked as technical failures;
verify a cross-workspace or nonexistent service ID cannot create an
opportunity; confirm accepted items retain score 45 and are unverified.
No production environment changes are made by the GitHub branch itself.
