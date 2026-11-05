const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const sql = readFileSync(join(__dirname, '../supabase/migrations/20261105103000_provider_recovery_coordination_v2.sql'), 'utf8')
const qa = readFileSync(join(__dirname, '../QA_PROVIDER_RECOVERY_COORDINATION_V2.md'), 'utf8')

test('provider recovery claims use a single guarded database UPDATE', () => {
  assert.match(sql, /create or replace function public\.claim_provider_recovery_probe/)
  assert.match(sql, /update public\.external_provider_circuits[\s\S]*?where provider = p_provider/)
  assert.match(sql, /and cooldown_until <= clock_timestamp\(\)/)
  assert.match(sql, /and \(probe_lease_until is null or probe_lease_until <= clock_timestamp\(\)\)/)
  assert.match(sql, /or p_lease_seconds is null/)
  assert.match(sql, /probe_lease_token = v_token/)
  assert.match(sql, /probe_execution_id = p_execution_id/)
  assert.match(sql, /'cooldown_or_probe_busy'/)
})

test('only the unexpired lease token owner can clear a provider failure', () => {
  assert.match(sql, /create or replace function public\.complete_provider_recovery_probe/)
  assert.match(sql, /and probe_lease_token = p_lease_token/)
  assert.match(sql, /and probe_lease_until > clock_timestamp\(\)/)
  assert.match(sql, /when v_code = 429 then clock_timestamp\(\) \+ interval '24 hours'/)
  assert.match(sql, /else clock_timestamp\(\) \+ interval '15 minutes'/)
  assert.match(sql, /return v_updated is not null/)
})

test('backend-only RPC and telemetry prohibit anon and authenticated callers', () => {
  assert.match(sql, /revoke all on function public\.claim_provider_recovery_probe\(text,text,integer\)[\s\S]*?from public, anon, authenticated/)
  assert.match(sql, /revoke all on function public\.complete_provider_recovery_probe\(text,uuid,boolean,integer\)[\s\S]*?from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.claim_provider_recovery_probe\(text,text,integer\) to service_role/)
  assert.match(sql, /grant execute on function public\.complete_provider_recovery_probe\(text,uuid,boolean,integer\) to service_role/)
  assert.match(sql, /alter table public\.provider_source_call_events enable row level security/)
  assert.match(sql, /revoke all on public\.provider_source_call_events from public, anon, authenticated/)
  assert.match(sql, /alter table public\.external_provider_circuits enable row level security/)
  assert.equal((sql.match(/security invoker/g) || []).length, 2)
})

test('recovery actions do not call provider APIs, enable sources or send outreach', () => {
  assert.doesNotMatch(sql, /http_post|net\.http|send_email|insert into public\.opportunities|perform pg_sleep/i)
  assert.match(sql, /probe_lease_seconds|p_lease_seconds integer default 180/)
  assert.match(qa, /This PR adds an \*\*inert\*\*/i)
  assert.match(qa, /two simultaneous workspaces compete for one probe/i)
  assert.match(qa, /Do not add blind retries/i)
})

test('provider call event schema records only typed outcomes with no secrets or payloads', () => {
  assert.match(sql, /create table if not exists public\.provider_source_call_events/)
  assert.match(sql, /request_kind in \('discovery', 'recovery_probe'\)/)
  assert.match(sql, /outcome in \('success', 'failed', 'cooldown_skipped', 'probe_busy'\)/)
  assert.match(sql, /http_status integer check/)
  assert.doesNotMatch(sql, /api_key|authorization_header|raw_request|raw_response|error_body/)
})
