const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const onboardingSource = readFileSync(
  join(__dirname, '../src/components/Onboarding.jsx'),
  'utf8'
).replace(/\r\n/g, '\n')

const serviceSource = readFileSync(
  join(__dirname, '../src/services/opportunityEngine.js'),
  'utf8'
).replace(/\r\n/g, '\n')

const edgeSource = readFileSync(
  join(
    __dirname,
    '../supabase/functions/generate-onboarding-copy/index.ts'
  ),
  'utf8'
).replace(/\r\n/g, '\n')

test('onboarding exposes AI assist for the three high-value description fields', () => {
  for (const fieldType of [
    'main_goal',
    'service_description',
    'good_opportunity',
  ]) {
    assert(
      onboardingSource.includes(
        `handleAiAssist('${fieldType}')`
      )
    )
  }

  assert.equal(
    onboardingSource.match(/Generate with AI/g)?.length,
    3
  )
})

test('onboarding AI assist keeps generated copy editable in existing form state', () => {
  for (const expected of [
    'setPrimaryGoal(result.generated_text)',
    'description: result.generated_text',
    'good_opportunity_definition: result.generated_text',
    'AI draft generated. Review and edit it before continuing.',
  ]) {
    assert(onboardingSource.includes(expected))
  }
})

test('onboarding AI assist sends field-specific context instead of a generic prompt only', () => {
  for (const expected of [
    'business_name: businessName.trim()',
    'primary_goal: primaryGoal.trim()',
    'target_countries: idealForm.target_countries',
    'ideal_client_types: idealForm.ideal_client_types',
    'rejection_rules: idealForm.rejection_rules',
    'problems_solved: serviceProblemText',
  ]) {
    assert(onboardingSource.includes(expected))
  }
})

test('frontend service calls the authenticated onboarding copy edge function', () => {
  for (const expected of [
    "export async function generateOnboardingCopy",
    "'generate-onboarding-copy'",
    'workspace_id: workspaceId',
    'field_type: fieldType',
    'rough_text: roughText',
    'context',
  ]) {
    assert(serviceSource.includes(expected))
  }
})

test('edge function verifies workspace access before calling protected n8n webhook', () => {
  for (const expected of [
    "withSupabase(",
    "{ auth: 'user' }",
    ".from('workspaces')",
    ".eq('id', workspaceId)",
    "'x-opportunity-engine-key'",
    "Deno.env.get('N8N_WEBHOOK_SECRET')",
    "'opportunity-onboarding-assist'",
  ]) {
    assert(edgeSource.includes(expected))
  }

  assert(!edgeSource.includes('service_role'))
})
