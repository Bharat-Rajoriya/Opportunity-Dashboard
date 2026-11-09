# PR #83 — Discovery Hover, Review Badges, Grounded Quick Capture AI

## Visual defects fixed
The screenshots reveal:
- **Discovery workflow** cards in Dark mode become white/pale on hover, leaving very low contrast text. The selected (disabled) nav item may also inherit the app-wide pale disabled-button styling.
- **Awaiting review / Ready** count badges in Outreach carry a too-light lavender pill into Dark mode.

The new final-loaded `src/ui-quickcapture-review-pr83.css` layer explicitly scopes
hover, active, and disabled Discovery states to both themes, and provides readable
review-count pills in Light and Dark. It does **not** change navigation or counts.

## Quick Capture AI description assistance
Users can opt to **Improve description with AI** once they supply:
- A public project title (at least four characters).
- At least twenty characters of their own public-project notes.

The assistant rewrites *only these supplied facts* into clearer prose. It never
fetches the URL, scrapes the listing, verifies the buyer, infers payment status,
creates an opportunity, or automatically triggers the existing AI qualification
workflow. Generated text appears in a separate **Suggested description** box;
the user must click **Use this draft** to replace the text, or **Discard draft**
to keep their own notes.

The user can still manually edit the description after insertion and the
existing **Review capture → Save to review queue** workflow remains unchanged.
The rewrite is optional and can consume AI model usage. Source-page
instructions are treated as untrusted content.

## Integrations updated
- Existing `generate-onboarding-copy` Supabase Edge function accepts one new
  `manual_capture_description` field type with request length guards, existing
  authenticated workspace RLS checks and 5,000-character output limit.
- Existing n8n **Onboarding AI Assistant V1**, workflow
  `qjkNm5EfIQlWBs8e`, adds the same field type. Its prompt forbids
  inventing deadlines, budgets, platforms, buyer verification or fetched
  source facts and calls for a conservative rewrite.
- The n8n published version and deployed Edge function were verified as
  active. No additional credentials or services were created.
- Existing onboarding field types are unchanged.

**Important:** AI-generated prose can still contain factual mistakes.
A title and public notes are not proof of buyer intent, and a prompt does not
constitute a security guarantee. The user must check the draft and original
listing before saving or qualifying. Do not put personal contact information
in the notes.

## QA checklist
1. Dark mode: hover each Discovery Workflow step, including the disabled
   current step. Confirm no white background or invisible text.
2. Light mode: repeat hover, focus and current-step states.
3. Outreach: check `0 awaiting review` and `0 ready` pills in both themes.
4. Quick Capture: no title/notes → AI button disabled; notes less than 20
   characters → disabled; valid notes → AI suggestion appears separately.
5. Discard AI suggestion → original notes unchanged. Use suggestion → textarea
   replaced, then manual editing still works.
6. Confirm an AI error does not clear the existing typed text.
7. Check 390px and desktop widths, keyboard focus, loading/disabled states.
8. Confirm no automatic new opportunities, qualification runs or outreach.

## Verification boundaries
GitHub CI covers static contracts, lint, test and build. It cannot prove model
response fidelity, account-specific UI, or live authenticated request behavior.
Use a signed-in test workspace to perform an end-to-end AI rewrite before
declaring the feature fully verified.
