const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const appSource = readFileSync(
  join(__dirname, '../src/App.jsx'),
  'utf8'
).replace(/\r\n/g, '\n')

const serviceSource = readFileSync(
  join(__dirname, '../src/services/opportunityEngine.js'),
  'utf8'
).replace(/\r\n/g, '\n')

const edgeSource = readFileSync(
  join(
    __dirname,
    '../supabase/functions/generate-opportunity-pitch/index.ts'
  ),
  'utf8'
).replace(/\r\n/g, '\n')

test('opportunity cards expose manual pitch generation when no draft exists', () => {
  for (const expected of [
    '✨ Generate Pitch',
    'Generating Pitch...',
    'onGeneratePitch',
    "opportunity.outreach_status === 'not_generated'",
    'handleGenerateManualPitch(opportunity)',
  ]) {
    assert(appSource.includes(expected))
  }
})

test('manual pitch generation refreshes opportunities and review queue', () => {
  const start = appSource.indexOf(
    'const handleGenerateManualPitch = async'
  )
  const end = appSource.indexOf(
    '\n\n  const refreshDashboard',
    start
  )

  assert(start >= 0 && end > start)

  const flow = appSource.slice(start, end)

  assert(flow.includes('generateOpportunityPitch'))
  assert(flow.includes('fetchOpportunities(workspace.id)'))
  assert(flow.includes('loadReviewQueue(workspace.id)'))
  assert(flow.includes("outreach_status: 'drafted'"))
  assert(flow.includes("outreach_review_status: 'pending_review'"))
})

test('manual pitch frontend service calls the authenticated edge function', () => {
  for (const expected of [
    'export async function generateOpportunityPitch',
    "'generate-opportunity-pitch'",
    'workspace_id: workspaceId',
    'opportunity_id: opportunityId',
  ]) {
    assert(serviceSource.includes(expected))
  }
})

test('manual pitch edge function verifies workspace opportunity and preserves server-side secret', () => {
  for (const expected of [
    "withSupabase(",
    "{ auth: 'user' }",
    ".from('opportunities')",
    ".eq('id', opportunityId)",
    ".eq('workspace_id', workspaceId)",
    "'x-opportunity-engine-key'",
    "Deno.env.get('N8N_WEBHOOK_SECRET')",
    'opportunity-manual-pitch',
  ]) {
    assert(edgeSource.includes(expected))
  }

  assert(!edgeSource.includes('service_role'))
})
