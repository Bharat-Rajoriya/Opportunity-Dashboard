# PR #81 — System / Light / Dark appearance

## Behavior
The sidebar footer now includes three keyboard-accessible appearance buttons.
- **System** (default): follow `prefers-color-scheme` from the browser/OS, including live changes.
- **Light**: force the screenshot-inspired light palette.
- **Dark**: force the dashboard's indigo/navy dark palette.

Manual overrides are saved in the current browser via `localStorage`
(`opportunity-dashboard-theme`); choosing System removes the override.
This preference is **local to the browser**, not saved to Supabase or synced
across devices. Storage failures should not stop appearance changes.
An inline startup snippet in `index.html` applies the preferred theme before
the React bundle loads to avoid an initial flash of the wrong theme.

The `useThemePreference` hook resides in the app root so system appearance
updates remain active during authentication, onboarding, and workspace pages.
Dark mode overrides are scoped by `html[data-theme="dark"]`; the existing
light UI refresh remains the default styling. The sidebar stays indigo in
both appearances. App state and navigation are unaffected.

## Component coverage
- Workspace sidebar and Sign out, overview panels
- Unified Search, Sources, Saved Searches
- Provider Health, Discovery control/steps and query editor
- Opportunity cards and drawer, buyer verification evidence
- Quick Capture, Diagnostics, Outreach, platform filters
- Onboarding forms and progress

## Manual preview QA (required)
- In browser/OS dark appearance with System selected: confirm the full
  dashboard uses dark surfaces; switch OS to light **while app stays open**.
- Select Dark: switching OS to light must not override manual Dark.
- Select Light: switching OS to dark must not override manual Light.
- Refresh, open a second tab, choose System, and confirm the expected
  persistence/reset behavior.
- At desktop 1366 × 768 and 1440 × 900 confirm sidebar Sign out is still
  visible/clickable with the new switcher.
- At 390, 768, 1024px check sidebar controls, filters, detail drawer and
  onboarding; keyboard Tab+Enter/Space interaction and focus.
- Check text contrast and warning/error colors on Quick Capture, acquisition
  monitoring and detail safety checks. Do not mistake colored accents for
  verified buyer/provider states.

## Release notes and boundaries
No new backend services, migrations, tracking, AI, email alerts or changes
to lead verification/status/scoring. GitHub CI validates tests/lint/build.
CI **cannot confirm real-browser screenshots or live OS color-scheme toggling**.
