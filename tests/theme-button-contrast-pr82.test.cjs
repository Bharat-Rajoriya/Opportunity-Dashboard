const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const read = path => readFileSync(join(__dirname,'..',path),'utf8')

const rgb = hex => hex.match(/[\da-f]{2}/gi).map(x => parseInt(x,16)/255)
const luminance = hex => {
  const components = rgb(hex).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4)
  return components[0]*.2126 + components[1]*.7152 + components[2]*.0722
}
const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05)

test('key foreground/background combinations exceed 4.5:1 text contrast', () => {
  for (const [fg,bg] of [
    ['#ffffff','#7131e6'], // Light primary button
    ['#ffffff','#5923c7'], // Hover primary
    ['#ffffff','#8751f1'], // Dark primary button
    ['#ffffff','#7941db'], // Dark hover primary
    ['#17243a','#ffffff'], // Light secondary
    ['#17243a','#f0eaff'], // Light secondary hover
    ['#f0f3ff','#222d49'], // Dark secondary
    ['#f0f3ff','#343b61'], // Dark secondary hover
    ['#596477','#e8e9f2'], // Light disabled
    ['#c2cada','#2a344d'], // Dark disabled
  ]) assert(contrast(fg,bg) >= 4.5,`low contrast ${fg} on ${bg}: ${contrast(fg,bg).toFixed(2)}`)
})

test('button repair loads after theme selectors', () => {
  const app = read('src/App.jsx')
  const imports = [...app.matchAll(/^import ['"]([^'"]+\.css)['"]$/gm)].map(m=>m[1])
  assert.equal(imports.at(-1),'./engine-status-theme-pr85.css')
  assert.equal(imports.at(-4),'./button-contrast-v1.css')
})

test('primary refresh and shared CTAs have contrast and disabled states', () => {
  const css=read('src/button-contrast-v1.css')
  const hub=read('src/components/SourcesHubPage.jsx')
  for (const name of [
    'button.sources-hub-refresh',
    'button.unified-search-discover',
    'button.saved-searches-primary',
    'button.find-opportunities-btn',
    'button.opp-v2-primary-action',
    'button[class~="bg-violet-600"]',
    'button[class~="bg-violet-700"]',
    'button.sources-hub-manage',
    'button.discovery-v2-settings-link',
    '.quick-capture-form > button',
  ]) assert(css.includes(name),'missing button selector '+name)
  assert(hub.includes('className="sources-hub-refresh"'))
  assert(hub.includes('disabled={loading}'))
  assert(css.includes('background-color: var(--ui-disabled-bg)'))
  assert(css.includes('color: var(--ui-disabled-text)'))
  assert(css.includes(':hover:not(:disabled)'))
  assert(css.includes(':focus-visible'))
})

test('light and dark themes use distinct readable button colors', () => {
  const css=read('src/button-contrast-v1.css')
  assert(css.includes('--ui-cta-bg: #7131e6'))
  assert(css.includes('--ui-control-bg: #ffffff'))
  assert(css.includes('html[data-theme="dark"] .workspace-shell'))
  assert(css.includes('--ui-control-bg: #222d49'))
  assert(css.includes('--ui-control-text: #f0f3ff'))
  assert(css.includes('color: var(--ui-cta-text)'))
  assert(css.includes('color: var(--ui-control-text)'))
  assert(!css.includes('fetch('))
  assert(!css.includes('supabase.'))
})
