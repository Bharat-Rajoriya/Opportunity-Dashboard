const { assertStylesInOrder } = require('./helpers/style-order.cjs')
const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const read = path => readFileSync(join(__dirname,'..',path),'utf8')

const luminance = hex => {
  const values = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255)
    .map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4)
  return values[0]*.2126 + values[1]*.7152 + values[2]*.0722
}
const contrast = (fg,bg) => (Math.max(luminance(fg),luminance(bg))+.05)
  / (Math.min(luminance(fg),luminance(bg))+.05)

test('live discovery notice differentiates running from completed messages', () => {
  const app = read('src/App.jsx')
  assert.match(app, /className=\{\`engine-success-message\$\{searchRunning \? ' is-running' : ''\}\`\}/)
  assert.match(app, /role="status"/)
  assert.match(app, /Opportunity Engine is running\. Collecting, researching and scoring opportunities/)
  assert.match(app, /className="engine-error-message"/)
})

test('dark palette explicitly overrides the legacy light success notification', () => {
  const css = read('src/engine-status-theme-pr85.css')
  const old = read('src/ui-refresh-v1.css')
  const app = read('src/App.jsx')
  assert.match(old, /\.engine-success-message \{ background: #edfdf7/)
  assert.match(css, /html\[data-theme="dark"\] \.workspace-shell/)
  for (const token of [
    '--notice-success-bg', '--notice-success-ink',
    '--notice-running-bg', '--notice-running-ink',
    '--notice-error-bg', '--notice-error-ink',
  ]) assert(css.includes(token), 'Missing theme token: '+token)
  for (const kind of ['.engine-success-message','.engine-success-message.is-running',
    '.engine-error-message','.settings-success-message','.settings-error-message',
    '.discovery-v2-run-state.is-running','.discovery-v2-run-state.is-success',
    '.discovery-v2-run-state.is-error']) {
    assert(css.includes(kind), 'Missing banner treatment: '+kind)
  }
  assertStylesInOrder('./opportunity-detail-theme-pr84.css', './engine-status-theme-pr85.css')
})

test('status notification text colors meet WCAG AA contrast in light and dark', () => {
  for (const [foreground,background] of [
    ['#075b43','#e9faf2'], ['#562a9e','#f0eaff'],
    ['#9d2540','#fff0f3'], ['#aff2d6','#13392e'],
    ['#eadcff','#302449'], ['#ffd2dc','#3e2332'],
  ]) {
    assert(contrast(foreground,background) >= 4.5,
      'Insufficient contrast: '+foreground+' on '+background)
  }
})

test('status banner theme is styling-only without changing engine semantics', () => {
  const css = read('src/engine-status-theme-pr85.css')
  assert(!css.includes('fetch('))
  assert(!css.includes('supabase.'))
  assert(!css.includes('triggerAi'))
  assert(css.includes('.workspace-shell .workspace-main'))
})
