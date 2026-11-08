const test = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../scripts/lib/lead-quality-benchmark.mjs')

const make = (id,source,score,extras={}) => ({
  id,source,total_score:score,title:'Public project '+id,
  source_url:'https://example.com/project/'+id,
  published_at:null,research_status:'partial',
  source_result_type:'unknown',
  matched_service_id:'service-123',
  ...extras,
})

test('sampling covers each source and score band, deterministically', async () => {
  const { stratifiedSample } = await load()
  const rows=[
    make('a','google',80),make('b','google',81),
    make('c','google',62),make('d','google',32),
    make('e','freelancer',83),make('f','freelancer',55),
    make('g','freelancer',12),make('h','upwork',64),
  ]
  const first=stratifiedSample(rows,1)
  const second=stratifiedSample([...rows].reverse(),1)
  assert.deepEqual(first,second)
  assert.equal(first.length,7)
  assert(first.every(x=>x.review_label==='uncertain'))
  assert(first.every(x=>x.buyer_intent==='unknown'))
  assert.deepEqual(new Set(first.map(x=>x.source)),new Set(['google','freelancer','upwork']))
})

test('unknown publication and incomplete research are warning signals, not fake negatives', async () => {
  const { summarizeUnlabeled } = await load()
  const report=summarizeUnlabeled([
    make('a','google',79),
    make('b','google',90,{published_at:'2026-11-07T00:00:00Z',research_status:'complete'}),
  ])
  assert.equal(report.by_source.google.indicators.publication_date_missing,1)
  assert.equal(report.by_source.google.indicators.research_incomplete,1)
  assert.equal(report.by_source.google.score_75_plus,2)
  assert.equal((await load()).scoreBand(make('missing','google',null)),'unknown')
  assert(!Object.hasOwn(report,'precision_among_decided'))
})

test('review metrics exclude uncertain labels and show conservative fraction separately', async () => {
  const { summarizeReviews } = await load()
  const dimensions={
    buyer_intent:'yes', service_fit:'yes',source_authenticity:'yes',
    freshness:'yes',eligibility:'yes',commercial_fit:'unknown'
  }
  const rows=[
    {id:'one',source:'google',score_band:'high',review_label:'valid',review_evidence:'Posting explicitly requests a paid vendor',...dimensions},
    {id:'two',source:'google',score_band:'high',review_label:'invalid',review_evidence:'Clearly advertises an agency service, not a buyer request',...dimensions, buyer_intent:'no'},
    {id:'three',source:'freelancer',score_band:'medium',review_label:'uncertain',review_evidence:'',...dimensions}
  ]
  const r=summarizeReviews(rows)
  assert.equal(r.sample_size,3)
  assert.equal(r.reviewed_with_verdict,2)
  assert.equal(r.unresolved,1)
  assert.equal(r.precision_among_decided,0.5)
  assert.equal(r.conservative_valid_fraction,0.333)
  assert.equal(r.dimensions_no.buyer_intent,1)
  assert.match(r.warning,/Fewer than 20/)
})

test('review requires evidence and refuses duplicate labels or fabricated dimensions', async () => {
  const { summarizeReviews } = await load()
  const base={
    id:'one',source:'freelancer',score_band:'high',review_label:'valid',review_evidence:'Evidence in posting describes a paid project.',
    buyer_intent:'yes',service_fit:'yes',source_authenticity:'yes',freshness:'yes',eligibility:'yes',commercial_fit:'unknown'
  }
  assert.throws(()=>summarizeReviews([base,base]),/Duplicate review ID/)
  assert.throws(()=>summarizeReviews([{...base,review_evidence:'nice'}]),/at least 15/)
  assert.throws(()=>summarizeReviews([{...base,service_fit:'probably'}]),/Invalid dimension/)
  assert.throws(()=>summarizeReviews([{...base,freshness:'unknown'}]),/Valid leads require evidence-backed yes/)
  assert.throws(()=>summarizeReviews([{...base,review_label:'invalid'}]),/Invalid leads require at least one documented no/)
  assert.throws(()=>summarizeReviews([{...base,review_label:'pass'}]),/valid\/invalid\/uncertain/)
})

test('sample size must not be unbounded',async()=>{
  const {stratifiedSample}=await load()
  assert.throws(()=>stratifiedSample([make('a','google',80)],0),/perStratum/)
  assert.throws(()=>stratifiedSample([make('a','google',80)],101),/perStratum/)
})
