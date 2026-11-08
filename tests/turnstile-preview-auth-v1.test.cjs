const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const read = path => readFileSync(join(__dirname, '..', path), 'utf8')

test('preview login receives Turnstile tokens and explains domain restrictions', () => {
  const app = read('src/App.jsx')
  const widget = read('src/components/TurnstileCaptcha.jsx')
  assert(app.includes('const [captchaWidgetError, setCaptchaWidgetError]'))
  assert(app.includes('onError={setCaptchaWidgetError}'))
  assert(app.includes("captchaWidgetError === '110200'"))
  assert(app.includes('Cloudflare Turnstile Hostname Management'))
  assert(app.includes('if (!captchaEnabled || captchaToken) return true'))
  assert(app.includes('captchaToken: captchaToken || undefined'))
  assert(widget.includes("'error-callback': (code)"))
  assert(widget.includes("onErrorRef.current?.(String(code || 'verification-failed'))"))
  assert(widget.includes("onErrorRef.current?.('script-unavailable')"))
  assert(widget.includes("if (token) onErrorRef.current?.('')"))
})

test('turnstile site key is public client configuration, not a hardcoded secret', () => {
  const app = read('src/App.jsx')
  assert(app.includes('import.meta.env.VITE_TURNSTILE_SITE_KEY'))
  assert(!app.includes('TURNSTILE_SECRET_KEY'))
  assert(!app.includes('captchaToken: undefined,'))
})
