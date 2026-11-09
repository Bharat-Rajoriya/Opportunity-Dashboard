# PR #80 — Light-theme consistency and sidebar usability

## Confirmed from user screenshots
- The new light canvas and cards had dark Discovery Control Center, Discovery workflow and provider health surfaces with very low contrast.
- The tall desktop sidebar clipped its bottom account/sign-out area on a standard viewport: the navigation and footer competed for a fixed full-height container.
- Styling also remained dark in manual capture, diagnostics, outreach, and platform filters.

## Implementation
- Add one last-loaded `ui-refresh-v2.css` stylesheet, scoped to the signed-in workspace.
- Set a 100dvh-height flex sidebar on desktop with a scrollable `workspace-navigation` (`min-height:0; overflow-y:auto`) and a non-shrinking account/sign-out footer, including safe-area padding.
- Improve sidebar color contrast, hover states and active navigation.
- At <=1000px retain the existing top horizontal navigation and show a reachable sign-out action.
- Convert dark Discovery control cards and workflow nav to white surfaces with readable text.
- Normalize provider-health cards, manual Quick Capture, diagnostics, outreach and opportunity platform filters.
- Preserve success/warning/error distinctions, user-facing provider status meanings, saved-search controls, and existing app behavior.

## QA
- Check the exact sections shown in screenshots at desktop browser width, especially tall provider card text, dashboard scroll behavior, active navigation and the sidebar bottom.
- Verify Sign out button is clickable at 1366x768 and 1440x900 without browser zoom; lower sidebar nav items must be reachable by scrolling the navigation area.
- Verify 390px, 768px, and 1024px responsiveness, browser zoom at 125% and 150%, keyboard-only navigation and focus.
- CI covers static contracts, lint, test and build, **not authenticated real-browser visual verification**.
- No Supabase, n8n, database migrations, AI classification or provider state logic changes.

## Follow-up
If the Vercel preview shows remaining dark regions (e.g. account settings, popovers, or dialogs) or any inaccessible actions, capture the precise component and add a scoped CSS fix before merging. Don't replace evidence labels with the fabricated statuses in the design samples.
