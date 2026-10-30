const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const app = readFileSync(
  join(__dirname, '../src/App.jsx'),
  'utf8'
).replace(/\r\n/g, '\n')

const turnstile = readFileSync(
  join(__dirname, '../src/components/TurnstileCaptcha.jsx'),
  'utf8'
).replace(/\r\n/g, '\n')

test('Turnstile is configuration gated and loaded from Cloudflare', () => {
  assert(app.includes('VITE_TURNSTILE_SITE_KEY'))
  assert(app.includes('const captchaEnabled = Boolean(TURNSTILE_SITE_KEY)'))
  assert(turnstile.includes('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'))
  assert(turnstile.includes('window.turnstile.render'))
  assert(turnstile.includes("'expired-callback'"))
  assert(turnstile.includes("'error-callback'"))
})

test('email auth sends the CAPTCHA token to protected Supabase operations', () => {
  assert(app.includes('supabase.auth.signUp'))
  assert(app.includes('supabase.auth.signInWithPassword'))
  assert(app.includes('supabase.auth.resetPasswordForEmail'))
  assert(app.match(/captchaToken: captchaToken \|\| undefined/g).length >= 3)
  assert(app.includes('Complete the security check before continuing.'))
})

test('Google OAuth is configuration gated and returns to the current app origin', () => {
  assert(app.includes("VITE_GOOGLE_AUTH_ENABLED === 'true'"))
  assert(app.includes("provider: 'google'"))
  assert(app.includes('redirectTo: window.location.origin'))
  assert(app.includes("prompt: 'select_account'"))
  assert(app.includes('Continue with Google'))
})

test('password UI consistently requires eight characters', () => {
  assert(!app.includes('Use at least 6 characters.'))
  assert(app.includes('Use at least 8 characters.'))
  assert(app.includes('minLength={8}'))
})
