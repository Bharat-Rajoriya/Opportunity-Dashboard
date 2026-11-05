const test=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const sql=readFileSync(join(__dirname,'../supabase/migrations/20261105120000_ai_classification_performance_v2.sql'),'utf8')
const guide=readFileSync(join(__dirname,'../QA_AI_CLASSIFICATION_PERFORMANCE_V2.md'),'utf8')

test('schema preserves valid existing event types and records technical failures separately',()=>{
 for(const type of ['evaluated','rejected','qualified','duplicate','created','classification_error'])assert.match(sql,new RegExp("'"+type+"'"))
 assert.match(sql,/event_type in \(/)
})
test('source quality excludes technical model errors without changing output columns',()=>{
 assert.match(sql,/count\(e\.id\) filter \(where e\.event_type = 'classification_error'\)/)
 assert.match(sql,/greatest\(/)
 assert.match(sql,/security_invoker=true/)
 for(const column of ['evaluated','qualified','rejected','duplicates','created','average_preliminary_score'])assert.match(sql,new RegExp('as '+column+'\\b'))
})
test('deployment gate uses bounded batches and no automatic retries',()=>{
 assert.match(guide,/options\.timeout = 30000/)
 assert.match(guide,/options\.maxRetries = 0/)
 assert.match(guide,/batchSize:3/)
 assert.match(guide,/continueRegularOutput/)
 assert.match(guide,/ai_classification_unavailable/)
 assert.match(guide,/classification_error/)
})
test('technical failures never automatically become qualified opportunities',()=>{
 assert.match(guide,/gate_pass=false/)
 assert.match(guide,/not a proven production speed-up/)
})
