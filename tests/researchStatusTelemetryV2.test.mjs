import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getResearchStatusDetails } from '../src/lib/researchStatus.js'

test('research status labels are specific and do not expose provider internals', () => {
  for (const [code, label] of [
    ['company_identity_unverified', 'Company not identified'],
    ['provider_cooldown', 'Research provider cooling down'],
    ['provider_recovery_denied', 'Research temporarily deferred'],
    ['provider_error', 'Research provider error'],
    ['source_only', 'Source-only research'],
  ]) {
    const result = getResearchStatusDetails({ research_status: 'partial', research_detail_reason: code })
    assert.equal(result.label, label)
    assert.equal(result.tone, 'partial')
    assert.doesNotMatch(JSON.stringify(result), /lease_token|api_key|credential/i)
  }
})

test('completed research is never inferred from a stale reason on partial data', () => {
  const result = getResearchStatusDetails({ research_status: 'partial', research_detail_reason: 'web_research_completed' })
  assert.equal(result.tone, 'partial')
  assert.equal(result.label, 'Source-only research')
})

test('legacy partial opportunities are not assigned fabricated causes', () => {
  const result = getResearchStatusDetails({ research_status: 'partial' })
  assert.match(result.description, /specific reason was not recorded/)
})

test('pending, complete and failed states keep distinct labels', () => {
  assert.equal(getResearchStatusDetails({ research_status: 'pending' }).label, 'Research pending')
  assert.equal(getResearchStatusDetails({ research_status: 'complete', research_detail_reason: 'web_research_completed' }).label, 'Web research completed')
  assert.equal(getResearchStatusDetails({ research_status: 'failed' }).label, 'Research failed')
})

test('n8n research writes reason with existing status and never adds secrets', () => {
  const partial = readFileSync('n8n/research-status-v2/partial-research.n8n.txt','utf8')
  const full = readFileSync('n8n/research-status-v2/attach-full-research.n8n.txt','utf8')
  const migration = readFileSync('supabase/migrations/20261106220000_research_status_reason_v2.sql','utf8')
  assert.match(partial, /research_detail_reason: researchDetailReason/)
  assert.match(partial, /company_identity_unverified/)
  assert.match(partial, /provider_cooldown/)
  assert.match(partial, /provider_error/)
  assert.match(full, /research_detail_reason: 'web_research_completed'/)
  assert.match(migration, /alter table public.opportunities/)
  assert.doesNotMatch(migration, /service_role|api_key|lease_token/i)
})
