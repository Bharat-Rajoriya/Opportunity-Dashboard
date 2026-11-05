const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const load = file => fs.readFileSync(path.join(root, file), 'utf8')

test('diagnostics queries only workspace-scoped security invoker views', () => {
  const service = load('src/services/acquisitionDiagnostics.js')
  assert.match(service, /from\('acquisition_run_funnel_v1'\)/)
  assert.match(service, /from\('acquisition_rejection_reasons_v1'\)/)
  assert.equal((service.match(/\.eq\('workspace_id', workspaceId\)/g) || []).length, 2)
  assert.match(service, /limit\(PAGE_LIMIT \+ 1\)/)
  assert.match(service, /truncated: runs\.length > PAGE_LIMIT \|\| reasons\.length > PAGE_LIMIT/)
  assert.doesNotMatch(service, /\.insert\(|\.update\(|\.delete\(/)
})

test('diagnostics render loading, denied access, and empty states without triggering collection', () => {
  const view = load('src/components/AcquisitionDiagnostics.jsx')
  assert.match(view, /role="alert"/)
  assert.match(view, /No acquisition events in this view/)
  assert.match(view, /recorded stage/)
  assert.match(view, /selectedSource/)
  assert.match(view, /setDays/)
  assert.match(view, /cancelled = true/)
  assert.doesNotMatch(view, /triggerOpportunityEngine|generateOpportunityPitch|\.insert\(/)
})

test('workspace diagnostics navigation is authenticated and isolated from settings', () => {
  const app = load('src/App.jsx')
  const shell = load('src/components/WorkspaceShell.jsx')
  const config = load('src/config/workspaceUi.js')
  assert.match(app, /activePage === 'diagnostics' && <AcquisitionDiagnostics workspaceId=\{workspace\.id\} \/>/)
  assert.match(app, /if \(section\.id === 'diagnostics'\)/)
  assert.match(config, /id: 'diagnostics'/)
  assert.match(shell, /diagnostics: Activity/)
  assert.match(app, /if \(!user \|\| authMode === 'reset-password'\)/)
})

test('reporting migration preserves invoker RLS and rejects anonymous access', () => {
  const migration = load('supabase/migrations/20261105090000_acquisition_diagnostics_v1.sql')
  assert.equal((migration.match(/security_invoker = true/g) || []).length, 2)
  assert.match(migration, /revoke all on public\.acquisition_run_funnel_v1 from public, anon/)
  assert.match(migration, /revoke all on public\.acquisition_rejection_reasons_v1 from public, anon/)
})
