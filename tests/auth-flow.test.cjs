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
  assert.equal(validateSignUp('', 'secret1', 'secret1'), 'Email is required.')
  assert.equal(validateSignUp('user@example.com', 'short', 'short'), 'Password must be at least 6 characters.')
  assert.equal(validateSignUp('user@example.com', 'secret1', 'secret2'), 'Passwords do not match.')
  assert.equal(validateSignUp(' user@example.com ', 'secret1', 'secret1'), '')
})

test('Create Account opens a dedicated registration form instead of submitting signup immediately', () => {
  assert(source.includes("setAuthMode('sign-up')"))
  assert(source.includes("authMode === 'sign-up' ? 'Create your account' : 'Welcome back'"))
  assert(source.includes('id="confirm-password"'))
  assert(source.includes("onClick={authMode === 'sign-up' ? showSignIn : showCreateAccount}"))
  assert(source.includes("onSubmit={authMode === 'sign-up' ? handleSignUp : handleSignIn}"))
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
