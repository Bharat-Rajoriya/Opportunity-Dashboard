# PR #82 — Theme button contrast and state audit

## Reproduced from screenshots and style review

- In **Dark** mode, Sources Hub **Refresh status** could render as a white control with extremely faint text, especially while refresh was disabled.
- In **Light** mode, some purple call-to-action buttons inherited dark text. The existing styles independently override `background` and `color` in several imported CSS layers.
- A blanket disabled opacity reduction makes text on light backgrounds difficult to read.

## Focused correction

A single final-loaded `src/button-contrast-v1.css` file defines explicit text, background, border, hover and disabled pairs for:
- Primary CTAs: Refresh status, new discovery, search, Save, Find Opportunities, pitch and other Tailwind violet controls.
- Secondary actions: Manage source, edit search settings, browse results, saved search/digest, diagnostics and filters.
- Quick Capture, theme switcher, auth/onboarding violet actions.

Primary and secondary controls have separate pairs for Light and Dark. **Disabled does not mean invisible**: disabled buttons use deliberately readable neutral foreground/background pairs while retaining `cursor:not-allowed`, native `disabled`, and unchanged click handlers. All states retain visible keyboard focus rings.

## Regression test

`tests/theme-button-contrast-pr82.test.cjs` checks representative button selectors and foreground/background pairs for a **4.5:1 minimum** WCAG text-contrast threshold. CSS string checks are a structural safety net, **not** a complete computed-style/browser audit.

## Preview QA before merge

1. Sources Hub in both themes: Refresh status enabled and loading/disabled. Text and icon must remain legible in all cases.
2. Test primary and secondary actions on Search, Discovery, Saved, Sources, Opportunity Details, Outreach and Diagnostics.
3. Test hover, keyboard focus, and disabled states; ensure disabled actions stay non-clickable.
4. Check small-screen navigation, modal/dialog actions and onboarding.
5. Verify all button labels are legible at 100% and 125% browser zoom.

This patch does **not** change backend operations, scores, source status, or theme preference storage.
