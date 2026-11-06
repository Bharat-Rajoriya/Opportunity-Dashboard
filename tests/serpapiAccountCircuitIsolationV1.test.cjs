const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const manifest = JSON.parse(fs.readFileSync('n8n/serpapi-account2/circuit-switch-manifest.json', 'utf8'))
const sql = fs.readFileSync('supabase/migrations/20261107000000_serpapi_account2_circuit_isolation.sql', 'utf8')
const byName = Object.fromEntries(manifest.workflows.map(w => [w.workflow, Object.fromEntries(w.nodes.map(n => [n.name, n]))]))
const accountKey = 'serpapi_account_2'
function rpcBody(node) {
  const body = node.parameters.jsonBody
  assert.match(body, new RegExp("p_provider:\\s*'"+accountKey+"'"))
  assert.doesNotMatch(body, /p_provider:\s*'serpapi'/)
}
test('collector uses Account 2 for lookup and each guarded recovery RPC', () => {
  assert.equal(manifest.provider_key, accountKey)
  assert.equal(manifest.original_provider_key, 'serpapi')
  assert.equal(byName.collector['Get SerpApi Circuit (Google)'].parameters.filters.conditions[0].keyValue,accountKey)
  assert.match(byName.collector['Google Source Enabled'].parameters.jsCode, /circuit.provider === 'serpapi_account_2'/)
  for(const n of ['Claim SerpApi Recovery Lease','Complete SerpApi Recovery Success','Complete SerpApi Recovery Failure','Record SerpApi Normal Failure Safely']) rpcBody(byName.collector[n])
})
test('research uses the same Account 2 circuit for every request path', () => {
  assert.equal(byName.research['Get SerpApi Circuit (Research)'].parameters.filters.conditions[0].keyValue,accountKey)
  assert.match(byName.research['Can Research Company?'].parameters.conditions.conditions[0].leftValue,/row.provider !== 'serpapi_account_2'/)
  assert.match(byName.research['Partial Research'].parameters.jsCode,/circuit.provider === 'serpapi_account_2'/)
  for(const n of ['Claim Research Recovery Lease','Complete Research Recovery Success','Complete Research Recovery Failure','Record Normal Research Failure Safely']) rpcBody(byName.research[n])
})
test('credential and published-state constraints are explicit', () => {
  assert.equal(manifest.published,false)
  for(const w of manifest.workflows) {
    assert.equal(w.search_credential_name,'SerpApi Opportunity Dashboard 2')
    assert.notEqual(w.active_version_at_review,w.draft_version)
  }
})
test('fresh account is unverified and original account circuit remains unchanged', () => {
  assert.match(sql,/insert into public.external_provider_circuits/)
  assert.match(sql,/'account_2_verification_pending'/)
  assert.match(sql,/on conflict \(provider\) do nothing/)
  assert.doesNotMatch(sql,/delete from public.external_provider_circuits/i)
  assert.match(sql,/last_failure_source='recovery_probe_succeeded'/)
  assert.match(sql,/v_state:='verified_recently'/)
  assert.match(sql,/owner_user_id=v_uid/)
  assert.match(sql,/grant execute on function public.get_provider_health_summary_v1\(uuid\) to authenticated/)
})
