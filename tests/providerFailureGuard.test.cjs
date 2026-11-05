const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const sql = readFileSync(join(__dirname, '../supabase/migrations/20261105113000_provider_failure_guard_v1.sql'), 'utf8')
const guide = readFileSync(join(__dirname, '../QA_SERPAPI_N8N_RECOVERY_ACTIVATION.md'), 'utf8')

test('normal source failure cannot override an active probe lease', () => {
  assert.match(sql, /create or replace function public\.record_provider_failure_if_unleased/)
  assert.match(sql, /and \(probe_lease_token is null[\s\S]*probe_lease_until <= clock_timestamp\(\)\)/)
  assert.match(sql, /return v_updated is not null/)
})

test('only authentic provider failures are accepted; 429 keeps 24-hour cooldown', () => {
  assert.match(sql, /p_failure_code is null or p_failure_code < 400 or p_failure_code > 599/)
  assert.match(sql, /when p_failure_code = 429 then interval '24 hours' else interval '15 minutes'/)
  assert.match(sql, /last_failure_code = p_failure_code/)
})

test('RPC remains restricted to the backend service role', () => {
  assert.match(sql, /security invoker/)
  assert.match(sql, /revoke all on function public\.record_provider_failure_if_unleased\(text,integer,text\)[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.record_provider_failure_if_unleased\(text,integer,text\)[\s\S]*to service_role/)
  assert.doesNotMatch(sql, /security definer|http_post|net\.http|pg_sleep/i)
})

test('rollout records both active and previous versions and no credential changes', () => {
  assert.match(guide, /477d7702-cd35-4f95-a4bf-7840826d7fdd/)
  assert.match(guide, /63aeb131-2416-40b8-a0c7-851ca91d2c45/)
  assert.match(guide, /No live paid provider test has been executed/)
  assert.match(guide, /provider_source_call_events/)
})
