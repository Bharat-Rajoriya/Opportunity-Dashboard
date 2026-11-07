const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.join(__dirname, '../n8n/google-acquisition-v3')
const read = name => fs.readFileSync(path.join(root, name + '.n8n.txt'), 'utf8')
const runGoogle = (queries, failure = false) => {
  const circuit = {
    provider: 'serpapi_account_2',
    cooldown_until: new Date(Date.now()-60000).toISOString(),
    last_failure_code: failure ? 429 : 0,
  }
  const fn = new Function('$','$input',read('google-source-enabled'))
  return fn(() => ({ last: () => ({json:circuit}) }), {
    all: () => queries.map(query => ({json:{
      search_query:query,
      search_profile:{enabled_sources:['google']},
      adaptive_source_strategy:{source_plans:{google:{traffic_multiplier:1}}},
    }}))
  }).map(x=>x.json)
}
const runFilter=(title,snippet) =>
  new Function('$json',read('basic-pre-filter'))({
    title,snippet,source_url:'https://example.org/project',
    discovery_context:{business_profile:{rejection_rules:[]}},
  }).json

test('buyer-focused Google phrase retains service while avoiding first-person document search',()=>{
  const [r] = runGoogle(['our WordPress website needs a secure backup disaster recovery and update process'])
  assert.match(r.google_search_query, /"WordPress" "backup recovery"/)
  assert.match(r.google_search_query, /"hire a freelancer"/)
  assert.doesNotMatch(r.google_search_query, /our WordPress website needs/)
  assert.equal(r.search_query,'our WordPress website needs a secure backup disaster recovery and update process')
  assert.equal(r.google_query_strategy,'buyer_intent_v3')
})
test('WooCommerce topic and site-qualified query remain faithful',()=>{
  const result=runGoogle(['need a developer to fix WooCommerce checkout errors blocking customer orders','site:example.com looking for website developer'])
  assert.match(result[0].google_search_query, /"WooCommerce" "checkout fix"/)
  assert.equal(result[1].google_search_query,result[1].search_query)
})
test('recovery requires only one query and stays behind the circuit gate',()=>{
  const result=runGoogle(['WordPress security project','WooCommerce checkout help'],true)
  assert.equal(result.length,1)
  assert.equal(result[0]._serpapi_recovery_needed,true)
})
test('high-confidence guides are excluded before paid AI classification',()=>{
  assert.equal(runFilter('How to backup your wordpress website in 2026','This step-by-step guide shows four methods.').prefilter_reason,'editorial_not_buyer_request')
  assert.equal(runFilter('WordPress Backup and Recovery: Complete Guide','Learn about recovery plugins.').prefilter_reason,'editorial_not_buyer_request')
})
test('genuine hiring requests with a scope are not accidentally rejected',()=>{
  assert.equal(runFilter('Looking for WordPress developer to fix backups','We need a developer for a paid repair project.').prefilter_pass,true)
  assert.equal(runFilter('WordPress implementation request','Seeking a freelancer to build a customer portal.').prefilter_pass,true)
})
test('Google node consumes rewritten query; original is retained for provenance',()=>{
  const config=JSON.parse(fs.readFileSync(path.join(root,'search-node-config.json'),'utf8'))
  assert.match(config.q_parameter,/google_search_query/)
  assert.match(config.q_parameter,/search_query/)
  assert.equal(config.production_published,false)
  assert.equal(config.credential_name,'SerpApi Opportunity Dashboard 2')
})
