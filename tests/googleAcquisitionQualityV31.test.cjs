const test = require('node:test')
const assert = require('node:assert/strict')
const {readFileSync} = require('node:fs')
const path = require('node:path')
const root = path.join(__dirname, '..', 'n8n/google-acquisition-v3-1')
const source = readFileSync(path.join(root,'google-source-enabled.n8n.txt'),'utf8')
const annotate = readFileSync(path.join(root,'annotate-serpapi-response.n8n.txt'),'utf8')
const manifest = JSON.parse(readFileSync(path.join(root,'manifest.json'),'utf8'))
const runner = new Function('$json','$','$execution', annotate)
function validate(envelope, recovery = false) {
  const sourceData = {workspace_id:'workspace',search_query:'WordPress developer needed',_serpapi_recovery_needed:recovery}
  const $ = name => {
    if(name === 'Google Source Enabled') return {item:{json:sourceData}}
    throw Error('No recovery grant in unit fixture')
  }
  return runner(envelope,$,{id:'mock-execution'}).json
}
function googleQueries(queries, circuitFailureCode=0) {
  const circuit = {provider:'serpapi_account_2',
    last_failure_code:circuitFailureCode,
    cooldown_until:new Date(Date.now()-2000).toISOString()}
  return new Function('$','$input',source)(
    () => ({last:() => ({json:circuit})}),
    {all:() => queries.map(search_query=>({json:{search_query,
      search_profile:{enabled_sources:['google']},
      adaptive_source_strategy:{source_plans:{google:{traffic_multiplier:1}}}}}))}
  ).map(item=>item.json)
}
const successfulZero = {
  search_metadata:{id:'6aeee8ba4b95961d3ea40084',status:'Success'},
  search_information:{total_results:0,organic_results_state:'Fully empty'},
  error:"Google hasn't returned any results for this query."
}
test('exact production zero-result SerpApi envelope is valid and yields no candidates',()=>{
  const result=validate(successfulZero)
  assert.equal(result._serpapi_response_valid,true)
  assert.equal(result._serpapi_empty_results,true)
  assert.deepEqual(result.organic_results,[])
  assert.equal(result._serpapi_response_status,null)
})
test('real results remain intact',()=>{
  const candidate={title:'WordPress developer requested',link:'https://example.org/request'}
  const result=validate({search_metadata:{id:'ok',status:'Success'},
    organic_results:[candidate],search_information:{total_results:1}})
  assert.equal(result._serpapi_response_valid,true)
  assert.deepEqual(result.organic_results,[candidate])
  assert.equal(result._serpapi_empty_results,false)
})
test('no-results indication cannot hide a quota error or HTTP failure',()=>{
  const candidates=[
    {...successfulZero,error:{httpCode:429,message:'Quota exceeded'}},
    {...successfulZero,error:'Quota exceeded'},
    {...successfulZero,statusCode:429},
    {...successfulZero,search_metadata:{id:'m',status:'Error'}},
    {...successfulZero,search_metadata:{status:'Success'}},
    {...successfulZero,search_information:{total_results:1,organic_results_state:'Fully empty'}},
    {...successfulZero,error:{}},
    {search_metadata:{id:'success',status:'Success'},search_information:{total_results:0}},
  ]
  for (const envelope of candidates) {
    const result=validate(envelope)
    assert.equal(result._serpapi_response_valid,false,JSON.stringify(envelope))
    assert.equal(result._serpapi_empty_results,false)
  }
})
test('unleased recovery cannot treat an otherwise valid result as authorized',()=>{
  assert.equal(validate(successfulZero,true)._serpapi_response_valid,false)
})
test('short Google buyer searches are not exact-phrase overconstrained',()=>{
  const inputs=[
    'hiring Wordpress development',
    'our WordPress website needs a secure backup disaster recovery and update process',
    'need a developer to fix WooCommerce checkout errors blocking customer orders',
    'site:example.com looking for website developer'
  ]
  const rows=googleQueries(inputs)
  assert.deepEqual(rows.map(r=>r.google_search_query),[
    'WordPress developer needed',
    'WordPress backup recovery developer needed',
    'WooCommerce checkout fix developer needed',
    inputs[3]
  ])
  assert.ok(rows.every(r=>r.google_query_strategy==='buyer_intent_v3_1'))
  assert.ok(rows.every((r,i)=>r.search_query===inputs[i]))
  assert.ok(rows.slice(0,3).every(r=> !/ OR |-tutorial|"looking for"/.test(r.google_search_query)))
})
test('cooldown recovery probes remain one search only',()=>{
  const rows=googleQueries(['WordPress developer needed','WooCommerce checkout developer needed'],429)
  assert.equal(rows.length,1)
  assert.equal(rows[0]._serpapi_recovery_needed,true)
})
test('manifest pins unchanged credential, provider key, and unpublished draft',()=>{
  assert.equal(manifest.credential,'SerpApi Opportunity Dashboard 2')
  assert.equal(manifest.provider_circuit,'serpapi_account_2')
  assert.equal(manifest.published,false)
  assert.match(manifest.query_parameter,/google_search_query/)
  assert.notEqual(manifest.previous_active_version,manifest.prepared_draft_version)
})
