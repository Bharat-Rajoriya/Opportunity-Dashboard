const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { assertStylesInOrder, importedStyles } = require('./helpers/style-order.cjs')
const read = path => readFileSync(join(__dirname,'..',path),'utf8')

test('theme layers preserve actual precedence without tying every PR to last import', () => {
  const expected = [
    './ui-refresh-v1.css', './ui-refresh-v2.css', './theme-preference.css',
    './button-contrast-v1.css', './ui-quickcapture-review-pr83.css',
    './opportunity-detail-theme-pr84.css', './engine-status-theme-pr85.css',
  ]
  assertStylesInOrder(...expected)
  assert.throws(() => assertStylesInOrder(expected[2],expected[0]),/must follow/)
  assert.throws(() => assertStylesInOrder('./not-a-file.css'),/Missing stylesheet/)
  assert.equal(new Set(importedStyles()).size, importedStyles().length,'No duplicate CSS imports')
})

test('current navigation state is a page location, not a pressed toggle', () => {
  const shell = read('src/components/WorkspaceShell.jsx')
  assert.match(shell,/aria-current=\{selected \? 'page' : undefined\}/)
  assert.doesNotMatch(shell,/aria-pressed=\{selected\}/)
  assert.match(shell,/<nav className="workspace-navigation" aria-label="Workspace sections">/)
  assert.match(shell,/onClick=\{\(\) => onNavigate\(section.id\)\}/)
})

test('current Discovery step stays keyboard-focusable without navigating twice', () => {
  const nav = read('src/components/DiscoveryJourneyNav.jsx')
  assert.match(nav,/aria-current=\{active === id \? 'step' : undefined\}/)
  assert.match(nav,/if \(active !== id\) onNavigate\(id\)/)
  assert.doesNotMatch(nav,/disabled=\{active === id\}/)
  assert.match(nav,/<nav className="discovery-journey" aria-label="Opportunity discovery workflow">/)
})

test('icon-only theme controls retain an explicit accessible name at mobile widths', () => {
  const shell = read('src/components/WorkspaceShell.jsx')
  const theme = read('src/theme-preference.css')
  assert.match(shell,/aria-label=\{\`\$\{label\} appearance\`\}/)
  assert.match(shell,/aria-pressed=\{themePreference === id\}/)
  assert.match(theme,/\.workspace-theme-options button span \{ display:none; \}/)
  assert.match(shell,/aria-label="Sign out"/)
})

test('responsive containment preserves scrolling, modal height and long text', () => {
  const css = read('src/responsive-a11y.css')
  const sidebar = read('src/ui-refresh-v2.css')
  const app = read('src/App.jsx')
  assert(css.includes('overflow-wrap:anywhere'))
  assert(css.includes('.opportunity-detail-section p'))
  assert(css.includes('.quick-capture-ai-draft p'))
  assert(css.includes('scroll-padding-inline:12px'))
  assert(css.includes('overscroll-behavior:contain'))
  assert(css.includes('height:100dvh'))
  assert(css.includes('max-height:calc(100dvh - 2rem)'))
  assert(sidebar.includes('overflow-y: auto'))
  assert(sidebar.includes('.workspace-sidebar-footer'))
  assert(app.includes("import './responsive-a11y.css'"))
})

test('both themes retain keyboard focus and reduced-motion treatment', () => {
  const light = read('src/ui-refresh-v1.css')
  const dark = read('src/theme-preference.css')
  const status = read('src/engine-status-theme-pr85.css')
  assert.match(light,/prefers-reduced-motion:reduce/)
  assert.match(light,/\.workspace-shell :focus-visible/)
  assert.match(dark,/html\[data-theme="dark"\] \.workspace-shell :focus-visible/)
  assert(status.includes('--notice-running-bg'))
  assert(status.includes('--notice-error-ink'))
})
