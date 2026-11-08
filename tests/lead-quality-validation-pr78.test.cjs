const test = require('node:test')
const assert = require('node:assert/strict')
const load = () => import('../scripts/lib/lead-quality-findings.mjs')

const make = (id, source, score, extra = {}) => ({
  id, source, total_score:score, source_url:'https://example.com/post/'+id,
  title:'WordPress development project', published_at:'2026-11-08T00:00:00Z',
  research_status:'complete', source_result_type:'marketplace_post',
  matched_service_id:'a-valid-id', budget_text:'Fixed $400', ...extra
})

test('relative redirects and unsafe protocols are not accepted as original source links', async () => {
  const { sourceUrlStatus } = await load()
  assert.equal(sourceUrlStatus('/goto?url=opaque'),'relative')
  assert.equal(sourceUrlStatus('javascript:alert(1)'),'invalid')
  assert.equal(sourceUrlStatus('https://alice:pw@example.com/path'),'contains_credentials')
  assert.equal(sourceUrlStatus('https://example.com/post'),'https')
  assert.equal(sourceUrlStatus('http://example.com/post'),'http')
  assert.equal(sourceUrlStatus(''),'missing')
})

test('high-scoring Google redirect receives a review flag but not an invalid verdict', async () => {
  const { reviewFlags, prepareValidationQueue } = await load()
  const lead=make('google-redirect','google',86, {
    source_url:'/goto?url=opaque',
    published_at:null, research_status:'partial', source_result_type:null
  })
  assert(reviewFlags(lead).includes('source_url_relative'))
  assert(reviewFlags(lead).includes('publication_date_missing'))
  assert(reviewFlags(lead).includes('high_score_without_complete_research'))
  const queue=prepareValidationQueue([lead],6)
  assert.equal(queue[0].priority,1)
  assert.equal(queue[0].review_label,'uncertain')
  assert.equal(queue[0].source_url,'/goto?url=opaque')
  assert.equal(queue[0].reviewer_source_access,'not_checked')
})

test('provider advertisement titles trigger triage but do not automatically reject', async () => {
  const { reviewFlags, prepareValidationQueue }=await load()
  const lead=make('agency-post','google',84,{
    title:'LOOKING FOR WHITE-LABEL PARTNERSHIP!',
    published_at:null
  })
  assert(reviewFlags(lead).includes('title_may_be_provider_promotion'))
  const queue=prepareValidationQueue([lead])
  assert.equal(queue[0].priority,2)
  assert.equal(queue[0].review_label,'uncertain')
})

test('valid URLs and complete research do not create invented issues', async () => {
  const { reviewFlags } = await load()
  assert.deepEqual(reviewFlags(make('clean','freelancer',88)),[])
})

test('validation queue is deterministic and never contacts a source or modifies scores', async () => {
  const { prepareValidationQueue }=await load()
  const rows=[
    make('b','freelancer',80), make('a','freelancer',81),
    make('c','freelancer',51), make('d','google',82,{
      source_url:'/goto?x=1'}),
    make('e','google',55),make('f','upwork',64)
  ]
  const original=JSON.stringify(rows)
  const queue=prepareValidationQueue(rows,2)
  assert.deepEqual(queue,prepareValidationQueue([...rows].reverse(),2))
  assert.equal(JSON.stringify(rows),original)
  assert.equal(queue.length,6)
  assert(queue.every(row=>row.review_label==='uncertain'))
  assert(queue.every(row=>row.reviewer_evidence_url===''))
})

test('findings report flags incomplete evidence without inventing precision', async()=>{
  const { summarizeValidationFindings }=await load()
  const rows=[
    make('a','google',86,{source_url:'/goto?x=1',published_at:null}),
    make('b','freelancer',77),
  ]
  const report=summarizeValidationFindings(rows)
  assert.equal(report.total,2)
  assert.equal(report.by_source.google.high_score,1)
  assert.equal(report.flags.source_url_relative,1)
  assert.equal(report.flags.publication_date_missing,1)
  assert.equal(report.malformed_url_examples.length,1)
  assert(!('precision' in report))
})
