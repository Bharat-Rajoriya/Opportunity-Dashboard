# PR #86 — UI Quality & Regression Hardening

## Scope

A narrow, frontend-only audit of the merged Light/Dark styling work through
PR #85. No new dashboard features, backend endpoints, provider calls, AI,
Supabase schema, n8n changes, scoring, or acquisition behavior.

## Confirmed defects / maintenance risks

1. **Discovery workflow current step was disabled.** A disabled button cannot
   receive normal keyboard focus, even though `aria-current="step"` already
   identifies the location. Keep it in the tab order, retain
   `aria-current`, and ignore redundant clicks on the already-active step.
   The steps still navigate to the same existing sections.
2. **Sidebar navigation buttons used `aria-pressed` for location.** That is
   a toggle-button state, not a navigation location. Replace with
   `aria-current="page"` on the selected section.
3. **Theme controls hide their text on narrow screens.** Explicit
   `aria-label` keeps System, Light, Dark independently named even when
   their visible spans are hidden and icons are decorative.
4. **Old CI assertions demanded exact final stylesheet positions.** Those
   failed in successive UI PRs when later scoped patches were appended.
   Add `assertStylesInOrder` and check relative precedence so genuine layer
   reordering still fails, but adding a correct final override does not.
5. **Long unbroken project descriptions or URLs can expand grid children.**
   Add min-width/word-wrapping safeguards to existing responsive CSS; do not
   globally hide overflow, which could clip overlays and interactive controls.
   Keep independent navigation scrolling, drawer viewport boundaries,
   and horizontal navigation on mobile.

## Regression checks

- Correct page/step `aria-current` roles and keyboard reachability.
- Theme controls explicitly accessible even when icon-only.
- Sidebar footer/Sign out still present.
- Relative import order of the screenshot-inspired and later Light/Dark
  layers, plus no duplicate CSS imports.
- Responsive min-width, wrapping, drawer height and navigation behavior.
- Existing reduced-motion, keyboard focus and run-status theme rules.

## Required preview QA

Validate authenticated screens in **Light, Dark, System**, at desktop
1440×900 and 1366×768, tablet 1024×768, mobile 390×844 and 320×640,
and at 125%/200% browser zoom:

1. Tab through the sidebar and Discovery steps. Current step remains
   focusable, clearly announced as current, and clicking it does nothing.
2. Confirm Sign out is clickable with the sidebar nav scrolled to bottom.
3. At narrow widths, confirm System/Light/Dark buttons have clear labels
   for screen readers, and navigation scrolls horizontally without clipping.
4. Inspect Search, Sources, Discovery, Saved, Opportunities, Details drawer,
   Quick Capture, Outreach, Diagnostics and Settings for long text, focus,
   contrast, scroll containment and disabled-button legibility.
5. Verify dialogs and the opportunity drawer can be scrolled and closed.
6. Toggle System/Light/Dark and check after page refresh; no acquisition
   should start from merely visiting pages.

CI tests are *static guardrails*, not a complete automated WCAG audit
or an authenticated browser-session screenshot comparison. Do not claim
complete visual or accessibility certification without those checks.

## Follow-up advice

Avoid further stacking generic theme overrides. New UI should use the
existing theme tokens; any future larger CSS consolidation should be
separately scoped and visually tested to prevent regressions.
