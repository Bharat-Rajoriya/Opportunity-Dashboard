const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')
const read = path => readFileSync(join(__dirname,'..',path),'utf8')
const advanced = import(pathToFileURL(join(__dirname,'../src/lib/opportunityAdvancedFilters.js')).href)
const digest = import(pathToFileURL(join(__dirname,'../src/lib/savedDigestMatching.js')).href)

test('budget categories distinguish listed, estimated and missing evidence',async()=>{
  const {getBudgetEvidence, matchesAdvancedFilters}=await advanced
  assert.equal(getBudgetEvidence({budget_text:'USD 250 – USD 750',estimated_value_min:400}), 'listed')
  assert.equal(getBudgetEvidence({estimated_value_min:0,estimated_value_max:500}), 'estimated')
  assert.equal(getBudgetEvidence({estimated_value_min:null,estimated_value_max:null,budget_text:null}), 'unknown')
  assert.equal(matchesAdvancedFilters({budget_text:''},{budget_evidence:'listed'}),false)
  assert.equal(matchesAdvancedFilters({budget_text:null},{budget_evidence:'unknown'}),true)
})

test('project types recognize the stored source labels and preserve unknowns',async()=>{
  const {getProjectKind}=await advanced
  assert.equal(getProjectKind({project_type:'fixed'}),'fixed')
  assert.equal(getProjectKind({project_type:'Fixed-price work; long-term collaboration'}),'fixed')
  assert.equal(getProjectKind({project_type:'Hourly project'}),'hourly')
  assert.equal(getProjectKind({project_type:'Retainer'}),'ongoing')
  assert.equal(getProjectKind({project_type:'Website development project'}),'other')
  assert.equal(getProjectKind({project_type:null}),'unknown')
})

test('remote/unspecified is never treated as confirmed remote',async()=>{
  const {getWorkMode,matchesAdvancedFilters}=await advanced
  assert.equal(getWorkMode({remote_status:'Remote / unspecified'}),'unknown')
  assert.equal(getWorkMode({remote_status:'Fully remote'}),'remote')
  assert.equal(getWorkMode({remote_status:'Hybrid'}),'hybrid')
  assert.equal(getWorkMode({remote_status:'On-site'}),'onsite')
  assert.equal(getWorkMode({remote_status:''}),'unknown')
  assert.equal(matchesAdvancedFilters({remote_status:'Remote / unspecified'},{work_mode:'remote'}),false)
  assert.equal(matchesAdvancedFilters({remote_status:'Remote / unspecified'},{work_mode:'unknown'}),true)
})

test('saved presets and digests share advanced filter matching without provider requests',async()=>{
  const {matchesSavedSearchOpportunity}=await digest
  const row={title:'WordPress',source:'freelancer',country:'India',project_type:'Hourly project',
    remote_status:'Remote / unspecified',budget_text:'USD 30 per hour',total_score:80}
  const saved={query:'WordPress',source:'freelancer',country:'India',min_score:'70',recency:'all',
    budget_evidence:'listed',project_kind:'hourly',work_mode:'unknown'}
  assert.equal(matchesSavedSearchOpportunity(row,saved),true)
  assert.equal(matchesSavedSearchOpportunity(row,{...saved,work_mode:'remote'}),false)
  assert.equal(matchesSavedSearchOpportunity(row,{...saved,project_kind:'fixed'}),false)
  assert.equal(matchesSavedSearchOpportunity(row,{...saved,budget_evidence:'estimated'}),false)
})

test('UI persist and refresh query preserve all three filters',()=>{
  const ui=read('src/components/UnifiedSearchPage.jsx')
  const service=read('src/services/savedOpportunitySearches.js')
  const app=read('src/App.jsx')
  const migration=read('supabase/migrations/20261108085052_saved_search_advanced_filters_v1.sql')
  assert(ui.includes('matchesAdvancedFilters(item'))
  assert(ui.includes('setWorkMode(\'all\')'))
  assert(ui.includes('budget_evidence: budgetEvidence, project_kind: projectKind, work_mode: workMode'))
  assert(service.includes('...normalizeAdvancedFilters(input)'))
  assert(service.includes('budget_text,estimated_value_min,estimated_value_max,project_type,remote_status'))
  assert(app.includes('remote_status,'))
  assert(app.includes('project_type,'))
  assert(migration.includes("default 'all'"))
  assert(!ui.includes('triggerOpportunityEngine'))
  assert(!service.includes('triggerOpportunityEngine'))
})
