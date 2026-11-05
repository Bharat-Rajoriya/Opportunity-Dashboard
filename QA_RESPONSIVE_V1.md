# Responsive & Accessibility QA — V1

## Automated verification
- GitHub CI runs `npm run check` (ESLint, Node regression tests, Vite production build).
- The UI regression suite covers semantic modal names, focus management wiring, nested date-picker Escape behavior, filter labels/reset, and preserved critical actions.
- **Important:** Unit/static assertions and successful builds do not prove real keyboard interaction, visual layout, screen reader behavior or backend execution in an authenticated browser.

## Manual acceptance matrix
Use a signed-in **test workspace** and Vercel PR preview, not production data.

| Area | Desktop ≥1280px | Tablet ~768px | Mobile ~375px | Narrow mobile ~320px |
|---|---|---|---|---|
| Workspace nav | Sidebar fully visible | Horizontal nav scrolls | Nav scrolls without clipping | Nav accessible without horizontal page overflow |
| Overview | Cards, metrics, next action readable | Cards reflow | Single-column stack | No forced horizontal scroll |
| Discovery | Query builder and breakdown readable | Two columns collapse | No clipped source labels | Loading/errors readable |
| Opportunities | Platform chips + sort + filters functional | Responsive controls | Chips wrap, sort usable | Clear all filters usable |
| Opportunity details | Sidebar drawer, content scroll | Drawer stays within viewport | Close button visible | No horizontal overflow |
| Follow-up calendar | Date/time selection | Popup fits input | 7-day grid fits popup | No 288px minimum-width spill |
| Outreach review | Editor, approve, reject works | Long message scrolls | Buttons wrap | Rejection dialog scrollable |
| Settings | Business/services/proof forms scroll | Modal usable | Close + save visible | No viewport clipping |
| New onboarding | 5-step progress and forms | Stepper scrolls | Each step readable | No input or validation clipping |

## Keyboard-focused checks
1. From Opportunities, Tab to **View Details** and press Enter. Focus should move into the drawer.
2. Tab and Shift+Tab through all focusable controls. Focus should remain inside the open dialog.
3. Open the follow-up calendar within the drawer. Press Escape once: **only the calendar** closes and focus returns to its trigger. Press Escape again: the opportunity drawer closes and focus returns to View Details.
4. In Settings, open each of Business Profile, Services, and Proof & Profiles. Test keyboard focus, scroll, Escape, and focus restoration.
5. Open Reject Outreach. The reason controls should be reachable, and Cancel/Escape should close it when no review write is pending.
6. Test the five opportunity filter fields with a screen reader: their labels should describe search/action/score/draft/status.

## Functional regression checks
1. Select Freelancer + Google platform filters, apply a score filter and search text; **Clear all filters** should reset all filters while preserving sort order.
2. Run Find Opportunities in a test workspace; inspect source diagnostics and error handling. Do not assume configured sources are within quota.
3. Open a saved lead; view buyer evidence, budget provenance and research status. Follow-up scheduling, notes and status updates should remain functional.
4. Review/edit a pitch, approve it, copy the approved message and manually mark sent **only after external sending**; do not treat the dashboard action as proof of delivery.
5. Verify Target Markets again with `usa` / `UK` mixed-case legacy saved values: choose multiple countries, save, reload, and confirm persistence.
6. For onboarding use a fresh test workspace; complete five stages and optional proof form. Existing production workspace should not be reset.

## Exit criteria
- No console errors during primary flows.
- No clipped inputs/buttons or unintended full-page horizontal scroll at 320/375/768px.
- Keyboard focus does not escape modal dialogs and returns to the opener on close.
- No unintended changes to backend search, scoring, source provider configuration, or outreach state.
- Review and merge PR only after both automated checks and authenticated visual/manual checks pass.
