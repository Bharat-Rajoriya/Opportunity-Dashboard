const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const source = readFileSync(join(__dirname, '../src/App.jsx'), 'utf8').replace(/\r\n/g, '\n')

const validationStart = source.indexOf('function validateSignUp(')
const validationEnd = source.indexOf('\nfunction getFollowUpBucket', validationStart)
assert(validationStart >= 0 && validationEnd > validationStart)

const validateSignUp = new Function(
  source.slice(validationStart, validationEnd) + '\nreturn validateSignUp'
)()

test('signup validation requires an email and valid matching passwords', () => {
  assert.equal(validateSignUp('', 'secret123', 'secret123'), 'Email is required.')
  assert.equal(validateSignUp('user@example.com', 'short', 'short'), 'Password must be at least 8 characters.')
  assert.equal(validateSignUp('user@example.com', 'secret123', 'secret124'), 'Passwords do not match.')
  assert.equal(validateSignUp(' user@example.com ', 'secret123', 'secret123'), '')
})

test('Create Account opens a dedicated registration form instead of submitting signup immediately', () => {
  assert(source.includes("setAuthMode('sign-up')"))
  assert(source.includes("'Create your account'"))
  assert(source.includes("'Welcome back'"))
  assert(source.includes('id="confirm-password"'))
  assert(source.includes("onClick={showForgotPassword}"))
  assert(source.includes("showCreateAccount"))
  assert(source.includes("handleSignUp"))
  assert(source.includes("handleSignIn"))
})

test('successful signup supports both immediate onboarding and email confirmation', () => {
  assert(source.includes('if (data?.session?.user)'))
  assert(source.includes('await loadWorkspace(data.session.user)'))
  assert(source.includes('Confirm your email, then sign in to start onboarding.'))
})

test('missing new-user workspace is created as incomplete so onboarding opens', () => {
  const workspaceStart = source.indexOf('  const loadWorkspace = useCallback(')
  const workspaceEnd = source.indexOf('\n\n  // -----------------------------------------------------\n  // LOAD OPPORTUNITIES', workspaceStart)
  const workspaceSource = source.slice(workspaceStart, workspaceEnd)

  assert(workspaceSource.includes('.maybeSingle()'))
  assert(workspaceSource.includes(".from('workspaces')"))
  assert(workspaceSource.includes('owner_user_id: currentUser.id'))
  assert(workspaceSource.includes('onboarding_completed: false'))
  assert(source.includes('workspace.onboarding_completed === false'))
  assert(source.includes('<Onboarding'))
})


test('sign-in screen exposes a forgot password flow', () => {
  assert(source.includes('Forgot password?'))
  assert(source.includes("setAuthMode('forgot-password')"))
  assert(source.includes('handleForgotPassword'))
  assert(source.includes('Send Reset Link'))
})

test('forgot password sends a Supabase recovery email to the current origin', () => {
  const start = source.indexOf('const handleForgotPassword = async')
  const end = source.indexOf('\n\n  const handleUpdatePassword', start)

  assert(start >= 0 && end > start)

  const flow = source.slice(start, end)

  assert(flow.includes('supabase.auth.resetPasswordForEmail'))
  assert(flow.includes('email.trim()'))
  assert(flow.includes('redirectTo: window.location.origin'))
  assert(flow.includes('Password reset email sent.'))
})

test('password recovery auth event opens the new password form instead of the dashboard', () => {
  const authStart = source.indexOf(
    'supabase.auth.onAuthStateChange((event, session) => {'
  )
  const authEnd = source.indexOf(
    '\n\n    return () => {',
    authStart
  )

  assert(authStart >= 0 && authEnd > authStart)

  const authSource = source.slice(authStart, authEnd)

  assert(authSource.includes("event === 'PASSWORD_RECOVERY'"))
  assert(authSource.includes("setAuthMode('reset-password')"))
  assert(source.includes("if (!user || authMode === 'reset-password')"))
})

test('new password flow validates confirmation then updates password and signs out', () => {
  const start = source.indexOf('const handleUpdatePassword = async')
  const end = source.indexOf('\n\n  const handleSignOut', start)

  assert(start >= 0 && end > start)

  const flow = source.slice(start, end)

  assert(flow.includes("Password must be at least 8 characters."))
  assert(flow.includes("Passwords do not match."))
  assert(flow.includes('supabase.auth.updateUser'))
  assert(flow.includes('password,'))
  assert(flow.includes('await supabase.auth.signOut()'))
  assert(flow.includes("setAuthMode('sign-in')"))
  assert(
    flow.includes(
      'Password updated successfully. Sign in with your new password.'
    )
  )
})
