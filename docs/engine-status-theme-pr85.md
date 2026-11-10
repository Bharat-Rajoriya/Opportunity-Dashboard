# PR #85 — Search/Discovery Engine Status Theme Parity

## Confirmed issue
The user screenshot shows the running Opportunity Engine notice painted in a mint
Light-mode background while the rest of the page is in Dark mode.

Root cause: `ui-refresh-v1.css` overrides `.engine-success-message`
to a light `#edfdf7` background, while `theme-preference.css` does not
override that particular class. The original `App.css` was already
Dark-oriented, but is imported earlier, so it lost the cascade.

## Fix
- Add `is-running` to the existing engine status notice only while
  `searchRunning` is true. The message content and `role=status` stay intact.
- Add a last-loaded, workspace-scoped `engine-status-theme-pr85.css`.
- Light: running lavender, completed notice mint, error pale rose.
- Dark: running deep violet, completed notice deep green, error deep rose.
- Also cover the matching `settings-*-message` and Discovery control-panel
  `discovery-v2-run-state` classes, without changing their data or status.
- Preserve accessibility: WCAG AA minimum 4.5:1 contrast for the specified
  text/background pairs; nested text/icons inherit the correct ink.

## Manual preview QA
1. In both themes, start a real **Find Opportunities** run if provider quota
   and cost are acceptable; observe the running notice and the completion
   notice. **Do not trigger runs just for visual styling if quota is limited.**
2. Check error state using a safe pre-existing error or staging fixture,
   not by altering production credentials or forcing an acquisition failure.
3. Switch between Light/Dark/System; check running, success, error, and
   settings confirmation notices after a theme change.
4. Check desktop and mobile, including 125% zoom, and visible keyboard focus.
5. Confirm no new provider calls, scoring edits, DB writes or changes to
   how a job moves between queued/running/completed/failed.

CI tests inspect source structure and colors; they cannot replace
authenticated browser screenshots or verify a live provider execution.
