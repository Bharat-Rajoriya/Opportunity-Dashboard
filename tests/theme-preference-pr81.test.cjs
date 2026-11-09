const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const read = path => readFileSync(join(__dirname,'..',path),'utf8')

test('system is default and follows device preference; explicit choice wins', async () => {
  const { normalizeThemePreference,resolveTheme,THEME_OPTIONS } = await import('../src/hooks/useThemePreference.js')
  assert.deepEqual(THEME_OPTIONS,['system','light','dark'])
  assert.equal(normalizeThemePreference(null),'system')
  assert.equal(normalizeThemePreference('auto'),'system')
  assert.equal(resolveTheme('system',true),'dark')
  assert.equal(resolveTheme('system',false),'light')
  assert.equal(resolveTheme('light',true),'light')
  assert.equal(resolveTheme('dark',false),'dark')
  assert.equal(resolveTheme('invalid',true),'dark')
})

test('system preference listens for OS changes and manual choice is persistent', () => {
  const source = read('src/hooks/useThemePreference.js')
  assert(source.includes("window.matchMedia?.('(prefers-color-scheme: dark)')"))
  assert(source.includes("media?.addEventListener?.('change', refresh)"))
  assert(source.includes("media?.removeEventListener?.('change', refresh)"))
  assert(source.includes("window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference)"))
  assert(source.includes("window.localStorage.removeItem(THEME_STORAGE_KEY)"))
  assert(source.includes("window.addEventListener('storage', syncTabs)"))
  assert(source.includes("document.documentElement.dataset.theme = theme"))
  assert(source.includes("document.documentElement.style.colorScheme = theme"))
  assert(source.includes('try {'))
})

test('dark theme is painted before the React app mounts', () => {
  const html=read('index.html')
  assert(html.indexOf('document.documentElement.dataset.theme = theme') < html.indexOf('<div id="root"></div>'))
  assert(html.includes('prefers-color-scheme: dark'))
  assert(html.includes('opportunity-dashboard-theme'))
})

test('the theme switcher is accessible and never displaces sign out', () => {
  const shell = read('src/components/WorkspaceShell.jsx')
  const css=read('src/theme-preference.css')
  assert(shell.includes('aria-label="Appearance"'))
  assert(shell.includes("id: 'system', label: 'System'"))
  assert(shell.includes("id: 'light', label: 'Light'"))
  assert(shell.includes("id: 'dark', label: 'Dark'"))
  assert(shell.includes("aria-pressed={themePreference === id}"))
  assert(shell.includes('onChangeTheme?.(id)'))
  assert(shell.indexOf('workspace-theme-switcher') < shell.indexOf('workspace-signout'))
  assert(css.includes('.workspace-theme-switcher'))
  assert(css.includes('@media(max-width:1000px)'))
  const sidebar=read('src/ui-refresh-v2.css')
  assert(sidebar.includes('overflow-y: auto'))
  assert(sidebar.includes('flex: 0 0 auto'))
})

test('dark overrides cover key user flows and do not change acquisition logic', () => {
  const css=read('src/theme-preference.css')
  const app=read('src/App.jsx')
  for(const selector of [
    '.workspace-shell','.unified-search','.sources-hub','.saved-searches-page',
    '.opp-v2-drawer','.opp-v31-side-card','.discovery-v2-panel',
    '.discovery-journey','.quick-capture','.acq-page','.outreach-v2-section',
    '.onboard-v2-shell',
  ]) assert(css.includes(selector),'missing dark surface '+selector)
  assert(css.includes('html[data-theme="dark"]'))
  assert(!css.includes('fetch('))
  assert(!css.includes('supabase.'))
  assert(app.includes("import './theme-preference.css'"))
  assert(app.includes('const { preference: themePreference, setPreference: setThemePreference } = useThemePreference()'))
  assert(app.includes('themePreference={themePreference}'))
  assert(app.includes('onChangeTheme={setThemePreference}'))
})
