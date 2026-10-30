const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const app = readFileSync(
  join(__dirname, '../src/App.jsx'),
  'utf8'
).replace(/\r\n/g, '\n')

const migration = readFileSync(
  join(__dirname, '../supabase/migrations/20261030_workspace_owner_unique.sql'),
  'utf8'
).replace(/\r\n/g, '\n')

test('workspace provisioning reuses a row when a concurrent insert loses', () => {
  assert(app.includes("An auth event and the signup response can race to provision the"))
  assert(app.includes(".eq('owner_user_id', currentUser.id)"))
  assert(app.includes('.maybeSingle()'))
  assert(app.includes('if (creation.error)'))
})

test('database enforces one workspace per auth user', () => {
  assert(migration.includes('create unique index if not exists workspaces_owner_user_id_unique'))
  assert(migration.includes('on public.workspaces(owner_user_id)'))
  assert(!migration.toLowerCase().includes('delete from'))
})
