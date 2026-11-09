# PR #84 — Opportunity Open Source and Detail Drawer Contrast

## Confirmed from screenshots

1. **Open Source** was an `<a>` tag with the correct URL gating, but several prior button contrast rules targeted `<button>` only. In Dark mode, a white source-link background inherited pale text.
2. The View Details drawer's **Research status**, **Buyer's Requirements**, **Source**, and later sections used `bg-slate-950/60`. Previous theme rules handled `bg-slate-950`, which is a different class. As a result, low-contrast gray/light panels could coexist with dark text and labels.

## Scoped implementation

- Added `opportunity-detail-section` to the common DrawerSection wrapper, without modifying the JSX content or behavior.
- Added a final-loaded stylesheet `opportunity-detail-theme-pr84.css` with explicit, opaque **Light** and **Dark** drawer surfaces, body text, muted text, buttons, hover, disabled, and focus states.
- Styled `a.opp-v2-source-action` for both themes, including its external-link icon, hover and keyboard focus. The anchor remains rendered only when the existing `view.sourceUrl` is available; no URL logic changed.
- Preserved differentiated emerald (positive), amber (caution), and rose (negative) text and backgrounds for eligibility and commercial-fit evidence.
- Regression tests assert source-link semantics, last stylesheet order, source/section class coverage and representative minimum 4.5:1 text contrast.

## QA checklist

- Test **Open Source** and **View Details** from multiple saved opportunities in Light and Dark, both at 100% and 125% zoom.
- Check Drawer **Research status**, **Buyer's Requirements**, **Source**, **Opportunity Facts**, and **AI Outreach Draft**. All text should be readable against the opaque surfaces.
- Confirm eligibility, budget-fit and source-quality state colors still accurately reflect live data.
- Verify original listing opens in a new tab, and no Open Source button appears when a source URL is unavailable.
- Confirm keyboard focus and narrow viewport drawer scrolling.
- CI provides regression checks, lint/build and color-pair tests, **not** authenticated visual verification.

No Supabase, n8n, scoring, acquisition or authorization changes.
