
import { workflow, trigger, node, splitInBatches, nextBatch, expr, newCredential } from '@n8n/workflow-sdk';
const start=trigger({type:'n8n-nodes-base.manualTrigger',version:1,config:{name:'Manual Recovery Start'}});
const pending=node({type:'n8n-nodes-base.supabase',version:1,config:{
 name:'Get Pending Stale Research',credentials:{supabaseApi:newCredential('Supabase account')},
 parameters:{operation:'getAll',tableId:'opportunities',returnAll:true,matchType:'allFilters',filters:{conditions:[
 {keyName:'score_stage',condition:'eq',keyValue:'preliminary'},
 {keyName:'research_status',condition:'eq',keyValue:'pending'},
 {keyName:'status',condition:'eq',keyValue:'new'},
 {keyName:'outreach_status',condition:'eq',keyValue:'not_generated'}]}}
}});
const failed=node({type:'n8n-nodes-base.supabase',version:1,config:{
 name:'Get Failed Engine Runs',executeOnce:true,credentials:{supabaseApi:newCredential('Supabase account')},
 parameters:{operation:'getAll',tableId:'engine_runs',returnAll:true,matchType:'allFilters',
 filters:{conditions:[{keyName:'run_status',condition:'eq',keyValue:'failed'}]}}
}});
const groups=node({type:'n8n-nodes-base.code',version:2,config:{
 name:'Build Recovery Groups',parameters:{mode:'runOnceForAllItems',jsCode:"\nconst HOUR=3600000,now=Date.now();\nconst failed=new Set($input.all().map(i=>i.json||{}).filter(x=>x.run_status==='failed').map(x=>String(x.workspace_id)+'|'+String(x.master_execution_id)));\nconst rows=$('Get Pending Stale Research').all().map(i=>i.json||{});\nconst groups=new Map();\nfor(const row of rows){\n const run=String(row.last_master_execution_id||'');\n const key=String(row.workspace_id||'')+'|'+run;\n const updated=Date.parse(row.updated_at||row.created_at||'');\n const created=Date.parse(row.created_at||'');\n const published=row.published_at?Date.parse(row.published_at):NaN;\n if(!row.id||!row.workspace_id||!/^[0-9]+$/.test(run)||!failed.has(key))continue;\n if(row.status!=='new'||row.outreach_status!=='not_generated'||row.score_stage!=='preliminary'||row.research_status!=='pending')continue;\n if(!Number.isFinite(created)||created<now-240*HOUR||!Number.isFinite(updated)||updated>now-24*HOUR)continue;\n if(Number.isFinite(published)&&published<now-168*HOUR)continue;\n if(String(row.requirement||'').length<80)continue;\n if(!groups.has(key))groups.set(key,[]);\n if(groups.get(key).length<5)groups.get(key).push(row.id);\n}\nreturn [...groups.entries()].sort((a,b)=>b[0].localeCompare(a[0])).slice(0,2).map(([key,ids])=>{\n const pos=key.indexOf('|');\n return {json:{workspace_id:key.slice(0,pos),master_execution_id:key.slice(pos+1),candidate_count:ids.length,candidate_ids:ids}};\n});\n"}
}});
const loop=splitInBatches({version:3,config:{name:'Process Recovery Groups',parameters:{batchSize:1,options:{}}}});
const research=node({type:'n8n-nodes-base.executeWorkflow',version:1.3,config:{
 name:'Recover Research Only',parameters:{
 workflowId:{__rl:true,value:'Q1MQ3Lx1C9ABAdjW',mode:'list',cachedResultUrl:'/workflow/Q1MQ3Lx1C9ABAdjW',cachedResultName:'Opportunity Enrichment - V1'},
 workflowInputs:{mappingMode:'defineBelow',value:{
 workspace_id:expr('{{ $json.workspace_id }}'),master_execution_id:expr('{{ $json.master_execution_id }}'),requested_by_user_id:'',recovery_only:'true',recovery_candidate_ids:expr('{{ JSON.stringify($json.candidate_ids) }}')},
 matchingColumns:[],schema:[{"id":"workspace_id","displayName":"workspace_id","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"},{"id":"master_execution_id","displayName":"master_execution_id","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"},{"id":"requested_by_user_id","displayName":"requested_by_user_id","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"},{"id":"recovery_only","displayName":"recovery_only","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"},{"id":"recovery_candidate_ids","displayName":"recovery_candidate_ids","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"}],attemptToConvertTypes:false,convertFieldsToString:true},
 options:{waitForSubWorkflow:true}
}}});
const scoring=node({type:'n8n-nodes-base.executeWorkflow',version:1.3,config:{
 name:'Score For Manual Review Only',parameters:{
 workflowId:{__rl:true,value:'gP9uaThwYFX0xnhB',mode:'list',cachedResultUrl:'/workflow/gP9uaThwYFX0xnhB',cachedResultName:'Final Scoring'},
 workflowInputs:{mappingMode:'defineBelow',value:{
 workspace_id:expr('{{ $json.workspace_id }}'),master_execution_id:expr('{{ $json.master_execution_id }}'),recovery_only:'true',recovery_candidate_ids:expr('{{ $json.recovery_candidate_ids }}')},
 matchingColumns:[],schema:[{"id":"workspace_id","displayName":"workspace_id","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"},{"id":"master_execution_id","displayName":"master_execution_id","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"},{"id":"recovery_only","displayName":"recovery_only","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"},{"id":"recovery_candidate_ids","displayName":"recovery_candidate_ids","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"}],attemptToConvertTypes:false,convertFieldsToString:true},
 options:{waitForSubWorkflow:true}
}}});
const done=node({type:'n8n-nodes-base.code',version:2,config:{
 name:'Recovery Complete',parameters:{mode:'runOnceForAllItems',jsCode:"return [{json:{stage:'stale_research_recovery_v3',status:'completed',automatic_outreach:false,completed_at:new Date().toISOString()}}];"}
}});
export default workflow('stale-research-recovery-v3','Stale Research Recovery V3')
 .add(start).to(pending).to(failed).to(groups)
 .to(loop.onDone(done).onEachBatch(research.to(scoring.to(nextBatch(loop)))));
