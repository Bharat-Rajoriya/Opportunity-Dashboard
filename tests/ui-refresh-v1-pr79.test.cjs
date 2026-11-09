const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const read = p => readFileSync(join(__dirname, '..', p), 'utf8')

test('UI Refresh V1 is imported last so it can override old dark surfaces', () => {
  const app = read('src/App.jsx')
  const imports = [...app.matchAll(/^import ['"]([^'"]+\.css)['"]$/gm)].map(x => x[1])
  assert.equal(imports.at(-1), './ui-refresh-v1.css')
})

test('visual tokens align with screenshot references and remain scoped', () => {
  const css = read('src/ui-refresh-v1.css')
  for (const token of [
    '--ui-page: #f6f7fb', '--ui-sidebar: #201c4b', '--ui-purple: #7b35ef',
    '--ui-card: #ffffff', '--ui-heading: #121d33', '--ui-border: #dfe6ef',
    '--ui-teal-bg: #d0faf1', '--ui-warning-bg: #fff1c9',
  ]) assert(css.includes(token), 'missing token ' + token)
  for (const surface of [
    '.workspace-sidebar', '.workspace-nav-link.is-active', '.unified-search-layout',
    '.sources-hub-grid', '.saved-searches-item', '.opp-v31-side-card',
    '.onboard-v2-shell', '.opp-v2-drawer',
  ]) assert(css.includes(surface), 'missing surface ' + surface)
  assert(css.includes('@media(max-width:740px)'))
  assert(css.includes('@media(max-width:1000px)'))
  assert(css.includes('prefers-reduced-motion'))
})

test('refresh cannot introduce mock source connections, false buyer safety claims or API logic', () => {
  const css = read('src/ui-refresh-v1.css')
  const app = read('src/App.jsx')
  const sources = read('src/components/SourcesHubPage.jsx')
  const buyer = read('src/components/OpportunityDecisionSidebar.jsx')
  assert(!css.includes('https://'))
  assert(!css.includes('fetch('))
  assert(!css.includes('Synced 2 min ago'))
  assert(sources.includes('Direct API unavailable'))
  assert(sources.includes("row.state === 'verified_recently'"))
  assert(sources.includes("row.state === 'collected_in_latest_run'"))
  assert(sources.includes("' is-neutral'"))
  assert(css.includes('.sources-hub-status.is-neutral'))
  assert(sources.includes("buildProviderMonitorRows"))
  assert(buyer.includes('Buyer identity" value="Unverified"'))
  assert(buyer.includes('Payment verification" value="Unknown"'))
  assert(app.includes("import './ui-refresh-v1.css'"))
})

test('saved searches retain on-demand digest, not mock email alerts', () => {
  const saved = read('src/components/SavedSearchesPage.jsx')
  assert(saved.includes('In-app, on-demand only.'))
  assert(saved.includes('No scheduled emails'))
  assert(saved.includes('setInAppDigestFrequency('))
  assert(saved.includes('markInAppDigestReviewed('))
})
