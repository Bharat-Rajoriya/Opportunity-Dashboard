# PR #87 — Fiverr Manual Source (No Unauthorized Collector)

## Platform feasibility

Fiverr’s current seller opportunity model relies on matched briefs/Mira rather than a public browsable buyer-project feed. Fiverr’s official MCP product is aimed at **buyers finding freelancers**, not at collecting buyer demand for sellers. Its Community Standards prohibit unauthorized scraping. Consequently, this PR does not invent an API, add crawler endpoints, request credentials, or route Fiverr to Google/other collectors as a fake direct provider.

Official references:
- https://help.fiverr.com/hc/en-us/articles/52715474121361-Using-Fiverr-MCP-in-your-AI-agent
- https://help.fiverr.com/hc/en-us/articles/4415608857745-Personalized-offers-Briefs-for-freelancers
- https://help.fiverr.com/hc/en-us/articles/37554441398929-Our-Community-Standards

## Implementation

- **Sources Hub** now contains a clearly labeled **Fiverr — Manual only** card. It does not show `Connected`, `Selected`, or provider metrics.
- Clicking **Add Fiverr link with Quick Capture** expands the existing form, scrolls it into view, and focuses the project URL field.
- The public project link and user-entered requirements are saved through the existing Quick Capture review flow, with explicit AI qualification only when authorized.
- Fiverr domains are displayed as **Fiverr (manual)** in the preview and queue. The persisted `source_platform` remains `other`, which is already accepted by the database's check constraint and worker. This is deliberate: it is a UI-only display label, not a new authenticated provider identity. Existing Freelancer/Upwork behavior remains unchanged.
- Only exact `fiverr.com` and subdomains qualify for that display label, not lookalike domains.
- Do not capture a seller Gig advertisement as a buyer opportunity. Buyer intent, public accessibility, and project freshness require manual source review.

## Behavior and boundaries

This release does not automatically discover Fiverr clients, read account-only briefs, crawl listings, connect a Fiverr API, verify buyer identity or payment, or send outreach. It does not modify Supabase schema, n8n, AI scoring, provider quota, or the engine's `enabled_sources` catalogue. Fiverr is **not** a checkbox in search profile settings because it has no supported automated collector.

## Preview acceptance checklist

1. Sources Hub displays the Fiverr card as Manual only, separate from Google/Freelancer/Upwork provider monitoring.
2. Click **Add Fiverr link with Quick Capture** and ensure the form opens and URL input receives focus.
3. Preview a real user-provided public Fiverr URL and verify the platform label shows `Fiverr (manual)`. Do not paste contact data.
4. Test lookalike domains (e.g. `fiverr.com.example.org`) and confirm they are not labeled Fiverr.
5. Save one test capture in an authorized workspace, check its source label and that it stays in the manual review queue. Do not run optional AI triage unless you intend to consume AI usage.
6. Check dark/light themes, responsive screen sizes, keyboard focus and screen reader labels.
7. Confirm no Fiverr option is incorrectly shown as connected in automatic Search or provider health.

## Next step for any direct integration

A genuine direct provider integration requires Fiverr’s explicit, documented authorization and a buyer-opportunity endpoint appropriate for seller-facing discovery. Until then, do not build browser automation or a scraper as a workaround.
