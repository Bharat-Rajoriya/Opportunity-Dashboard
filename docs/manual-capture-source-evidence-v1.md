# Manual Capture — Source Evidence Review V1 (PR #73)

## Purpose

Provide a lightweight post-qualification review without pretending that a
browser-opened URL proves buyer identity or posting authenticity.

## Workflow

1. Use Sources → Quick Capture to create and explicitly AI-qualify a request.
2. Only a `qualified` capture with a matching manual-capture Opportunity can
   receive a source observation.
3. Open the original link yourself and choose **Appeared open**, **Unavailable**,
   or **Unclear**. For unclear observations, a meaningful note is required.
4. The recorded observation, timestamp and optional note appear beside the capture.

## Trust boundaries

- The server stores a **human observation**, not an independently verified fact.
- This does not fetch URLs or authenticate platform accounts.
- The owner-scoped SQL RPC explicitly checks `auth.uid()`, workspace ownership,
  capture identity, a `qualified` outcome and the associated manual Opportunity.
- Clients cannot directly edit machine-managed source-review fields.
- The source remains `source_verified=false`, score stays capped at 45, and
  no automatic pitch or outreach is initiated.
- No n8n workflow changes or paid provider calls.
- Do not use `Appeared open` as proof that a buyer is real, payment is valid,
  the posting is current or a project is available.

## Release and validation

The new migration must be applied before using the Vercel preview; otherwise
the additional select fields and RPC will not exist.

Run `npm run check`. Verify an authorized qualified capture can be reviewed,
an unqualified capture cannot, a cross-workspace request fails, and an observed
unavailable link does not automatically alter opportunity scoring or outreach.
The production database currently has no user-owned Quick Capture records,
so actual end-to-end capture testing is still required.

## Next phase

Independent source verification should be implemented only for a supported
platform with an official source API and credentials, with clear evidence,
freshness, provider errors and revocation states. This PR intentionally avoids
uncontrolled arbitrary-URL fetching and SSRF exposure.
