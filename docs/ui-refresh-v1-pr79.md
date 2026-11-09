# PR #79 — Screenshot-Inspired UI Refresh V1

## Design reference
Five user-supplied mockups: Search, Sources, Saved Searches, Opportunity Details,
and the setup flow. Apply **visual language**, not invented product behavior.

### Tokens
- Canvas: `#F6F7FB`; cards: `#FFFFFF`
- Sidebar: `#201C4B`; active menu: `#4536CB`
- Primary action: `#7B35EF`; hover: `#6929DB`
- Heading: `#121D33`; body: `#516178`
- Borders: `#DFE6EF`
- Evidence/status accents: mint, amber and lavender, never interpreted as proof of a verified provider

## Implemented
- Signed-in sidebar, navigation, active state, app canvas and shared cards
- Search input, filters, chips, opportunity rows, score labels and summary
- Three-column Sources cards where the viewport allows, status badges and actions
- Saved Searches list and **actual** on-demand digest controls
- Opportunity detail drawer, buyer evidence cards, proposal action styling
- Existing five-step, three-milestone onboarding flow (light inputs and progress surfaces)
- Responsive 2/1-column fallbacks and reduced-motion rule

## Preserve core semantics
- All source statuses are still derived from provider monitoring, not mock `Connected` badges.
- Upwork direct API remains unavailable unless the backend actually becomes available.
- Payment and buyer identity stay unverified where appropriate.
- No fake sync timestamps, mock job cards, instant email alerts or background schedules.
- Real navigation has ten sections; mock six-item navigation is only a visual reference.
- No changes to Supabase, n8n, scoring, auth, redirects or any onClick logic.

## QA before merge
1. Confirm CI lint, test, build and Vercel preview pass.
2. At desktop widths (1440, 1200), check Search, Sources, Saved Searches, Opportunities
   and opportunity drawer, Settings, Overview, and onboarding.
3. At 1024, 768, 390 and 320 pixels confirm no clipped sidebar, filters or action buttons.
4. Check keyboard focus, disabled buttons, labels and color contrast in status messages.
5. Confirm actual provider states and opportunity evidence have not changed.
6. If a Tailwind utility-backed legacy section remains difficult to read, note it in the PR
   and fix with a scoped selector; **do not** invent UI features to fill the layout.

CSS is intentionally imported last into `src/App.jsx` and kept in one
`src/ui-refresh-v1.css` file for straightforward rollback. This is a CSS-led
baseline, not a claim that pixel-perfect visual regression testing has run.
