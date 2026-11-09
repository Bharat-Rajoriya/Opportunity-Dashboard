const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const read = p => readFileSync(join(__dirname, '..', p), 'utf8')

test('sidebar exposes reachable signout and scrollable navigation at desktop size', () => {
  const shell = read('src/components/WorkspaceShell.jsx')
  const css = read('src/ui-refresh-v2.css')
  assert(shell.includes('aria-label="Sign out"'))
  assert(shell.includes('onClick={onSignOut}'))
  assert(css.includes('height: 100dvh'))
  assert(css.includes('.workspace-navigation'))
  assert(css.includes('overflow-y: auto'))
  assert(css.includes('min-height: 0'))
  assert(css.includes('.workspace-sidebar-footer'))
  assert(css.includes('flex: 0 0 auto'))
  assert(css.includes('max(12px, env(safe-area-inset-bottom))'))
})

test('mobile navigation and signout remain accessible', () => {
  const css = read('src/ui-refresh-v2.css')
  assert(css.includes('@media (max-width: 1000px)'))
  assert(css.includes('overflow-x: auto; overflow-y: hidden'))
  assert(css.includes('height: auto'))
  assert(css.includes('.workspace-signout'))
  assert(css.includes('min-height: 38px'))
})

test('dark discovery surfaces are explicitly themed for readable light backgrounds', () => {
  const css = read('src/ui-refresh-v2.css')
  for (const part of [
    '.discovery-v2-panel', '.discovery-v2-config-grid > div',
    '.discovery-v2-run-state', '.discovery-v2-query-section',
    '.discovery-v2-stage', '.discovery-journey',
    '.discovery-journey-step', '.discovery-v2-editor textarea',
  ]) assert(css.includes(part), 'Missing discovery surface: '+part)
  assert(css.includes('background: #fff'))
  assert(css.includes('color: var(--ui-heading)'))
  assert(css.includes('.discovery-v2-run-state.is-error'))
  assert(css.includes('.discovery-v2-run-state.is-success'))
})

test('provider activity and key workflow panels have explicit theme mapping', () => {
  const css = read('src/ui-refresh-v2.css')
  for (const part of [
    'section[aria-labelledby="provider-health-heading"]',
    '.quick-capture', '.acq-page', '.outreach-v2-section',
    '.opp-platform-toolbar', '.workspace-signout',
  ]) assert(css.includes(part), 'Missing surface: '+part)
  assert(css.includes('section[aria-labelledby="provider-health-heading"] article.bg-emerald-500'))
  assert(css.includes('section[aria-labelledby="provider-health-heading"] article.bg-amber-500'))
})

test('V2 is presentation only and does not mutate provider states, claims or backend', () => {
  const css = read('src/ui-refresh-v2.css')
  const provider = read('src/components/ProviderHealthMonitor.jsx')
  const app = read('src/App.jsx')
  assert(!css.includes('fetch('))
  assert(!css.includes('supabase.'))
  assert(!css.includes('Connected'))
  assert(provider.includes('buildProviderMonitorRows'))
  assert(app.includes("import './ui-refresh-v2.css'"))
})
