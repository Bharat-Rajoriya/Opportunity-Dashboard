import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { interpretSerpApiHealth, buildProviderMonitorRows } from '../src/lib/providerHealthPresentation.js'

const now = Date.parse('2026-11-06T17:00:00Z')

test('rate limited Google is unavailable even if it produced historical events', () => {
  const rows = buildProviderMonitorRows({
    enabledSources: ['google','freelancer'],
    providerHealth: { state:'cooldown', cooldown_until:'2026-11-07T13:00:00Z' },
    sourceAnalytics: {google:{evaluated:147,created:0},freelancer:{evaluated:780,created:73}},
    latestRunCounts: {freelancer:{evaluated:30,created:1}},
    now,
  })
  const google=rows.find(x=>x.source==='google'),freelancer=rows.find(x=>x.source==='freelancer')
  assert.equal(google.state,'cooldown')
  assert.equal(google.evaluated30d,147)
  assert.equal(google.latestEvaluated,0)
  assert.equal(freelancer.state,'collected_in_latest_run')
  assert.equal(freelancer.latestCreated,1)
})

test('expired cooldown is recovery eligible, never falsely healthy', () => {
  const status=interpretSerpApiHealth({state:'cooldown',cooldown_until:'2026-11-05T00:00:00Z'},now)
  assert.equal(status.state,'recovery_eligible')
  assert.match(status.label,/not verified/i)
})

test('no active cooldown does not prove remaining SerpApi quota', () => {
  const status=interpretSerpApiHealth({state:'availability_unverified'},now)
  assert.equal(status.state,'availability_unverified')
  assert.match(status.detail,/does not confirm remaining quota/)
})

test('selected Upwork is not labeled operational without integration evidence', () => {
  const rows=buildProviderMonitorRows({enabledSources:['upwork'],now})
  const upwork=rows.find(x=>x.source==='upwork')
  assert.equal(upwork.state,'integration_unverified')
  assert.equal(rows.find(x=>x.source==='google').state,'not_configured')
})

test('no recent freelancer evaluations means configured but unverified', () => {
  const rows=buildProviderMonitorRows({enabledSources:['freelancer'],now})
  assert.equal(rows.find(x=>x.source==='freelancer').state,'configured_unverified')
})

test('provider summary SQL is authenticated, workspace scoped and sanitized', () => {
  const sql=readFileSync('supabase/migrations/20261106230000_provider_health_summary_v1.sql','utf8')
  assert.match(sql,/owner_user_id = v_uid/)
  assert.match(sql,/grant execute on function public\.get_provider_health_summary_v1\(uuid\) to authenticated/)
  assert.match(sql,/revoke all .* from public, anon, authenticated/)
  assert.doesNotMatch(sql,/jsonb_build_object\([^]*?lease_token/)
  const app=readFileSync('src/App.jsx','utf8')
  assert.match(app,/ProviderHealthMonitor/)
  assert.match(app,/loadProviderMonitor\(workspace\.id/)
})
