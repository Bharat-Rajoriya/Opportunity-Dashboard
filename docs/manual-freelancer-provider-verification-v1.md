# PR #74 — Freelancer Provider-Backed Listing Check V1

## Scope

An authenticated user can explicitly request a provider-backed **listing lookup**
for a previously AI-qualified manual Freelancer capture. Only persisted
Freelancer source URLs with an extractable numeric ID are supported; arbitrary
URL fetching, Upwork, Google, Reddit, and unsupported slug-only links are not.

- Edge Function: `verify-manual-freelancer-source`, `verify_jwt=true`.
- Private, header-authenticated n8n workflow: `k2uGXknUe4ZAQ4Dr`.
- Existing protected header credential: `Opportunity Engine Internal`.
- Existing production Freelancer OAuth credential: `Freelancer OAuth - Opportunity Engine`.
- Official project lookup: `GET https://www.freelancer.com/api/projects/0.1/projects/{project_id}`.
- Existing Edge secret: `N8N_WEBHOOK_SECRET` (never exposed in frontend).
- DB migration: `20261108232000_manual_freelancer_provider_check_v1.sql`.

## Verification semantics

A successful lookup confirms that the specific Freelancer API returned a
project with the requested ID and title at the time of the check.
It **does not** prove the owner is genuine, payment is available, the job is
still accepting bids, the user's services are eligible, or the title/description
provided in Quick Capture matches the provider content. Display
`provider_status` separately. The project remains `review`, score 45,
`raw_payload.source_verified=false`, no draft/outreach is initiated.

Failed API calls or credentials issues are *unknown*, not evidence that a
listing is unavailable. The current V1 deliberately does not mark a
listing as removed on a network/403/429/5xx response.

## Security

The Edge Function authenticates the user and loads capture/workspace by the
user's RLS client, rather than trusting frontend URLs or IDs. A strict
Freelancer hostname/path/numeric-ID parser prevents SSRF.
The signed internal request uses the n8n header secret. The response's
capture/workspace/project IDs, provider, boolean evidence flags and title
are validated before calling the service-role-only RPC. The DB checks
capture status, platform and matching linked Opportunity.
No raw provider response, contact details or OAuth tokens are persisted.
No search/acquisition flows are touched.

## Release sequence

1. Apply the new SQL migration to the linked Supabase project.
2. Deploy the Edge Function with JWT verification enabled.
3. Confirm the n8n verification workflow is published and both named
   credentials are bound. Confirm the path
   `opportunity-freelancer-project-verify`.
4. Run `npm run check`, inspect GitHub CI and Vercel preview.
5. Create a real qualified Freelancer capture and click **Check via Freelancer
   API**. Verify the evidence record and that opportunities score/outreach
   remain unchanged.
6. Test unsupported non-Freelancer and unqualified captures; cross-workspace
   access should fail. A missing project ID should produce an explanatory
   validation error without calling the API.

There are no existing production manual capture records at authoring time.
An authenticated real-capture smoke test is mandatory before claiming
the entire integration works. New schema must be available before the
preview loads the Quick Capture review queue.

## Rollback

Remove the UI action and/or disable the dedicated n8n verifier webhook.
Keep existing evidence rows for audit. Do not drop columns in a hot rollback.
