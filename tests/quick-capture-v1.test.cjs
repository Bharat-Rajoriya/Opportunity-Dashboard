const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

const read = path => readFileSync(join(__dirname, '..', path), 'utf8')
const validation = import(pathToFileURL(join(__dirname, '../src/lib/manualCaptureValidation.js')).href)

test('manual capture accepts HTTPS public projects and normalizes tracking duplicates', async () => {
  const { normalizeCaptureUrl, capturePlatform, validateCaptureDraft } = await validation
  const a = normalizeCaptureUrl('https://www.freelancer.com/projects/php/example/?utm_source=test#reviews')
  const b = normalizeCaptureUrl('https://www.freelancer.com/projects/php/example')
  assert.equal(a, b)
  assert.equal(capturePlatform(a), 'freelancer')
  assert.equal(capturePlatform('https://www.upwork.com/jobs/abc'), 'upwork')
  assert.equal(capturePlatform('https://example.org/projects/abc'), 'other')
  const draft = validateCaptureDraft({ url: a, title: 'WordPress website redesign', requirement: 'Looking for a developer to rebuild my business website.' })
  assert.equal(draft.source_platform, 'freelancer')
  assert.equal(draft.title, 'WordPress website redesign')
})

test('manual capture rejects unsafe or incomplete inputs', async () => {
  const { normalizeCaptureUrl, validateCaptureDraft } = await validation
  for (const url of [
    'javascript:alert(1)', 'http://freelancer.com/projects/abc',
    'https://localhost/project', 'https://127.0.0.1/project',
    'https://user:password@example.com/project', 'https://[::1]/project',
  ]) assert.throws(() => normalizeCaptureUrl(url))
  assert.throws(() => validateCaptureDraft({ url: 'https://example.org/project', title: 'ok', requirement: 'too short' }))
})

test('Quick Capture uses private review queue, no scraping and no direct opportunity writes', () => {
  const service = read('src/services/manualCaptures.js')
  const panel = read('src/components/QuickCapturePanel.jsx')
  const sources = read('src/components/SourcesHubPage.jsx')
  const migration = read('supabase/migrations/20261108093525_manual_capture_review_queue_v1.sql')
  assert(service.includes(".from('manual_capture_reviews')"))
  assert(service.includes(".eq('workspace_id', workspaceId)"))
  assert(!service.includes(".from('opportunities')"))
  assert(!service.includes('fetch('))
  assert(panel.includes('Review capture'))
  assert(panel.includes('Save to review queue'))
  assert(panel.includes('This is not yet a scored opportunity'))
  assert(panel.includes('rel="noopener noreferrer"'))
  assert(sources.includes('<QuickCapturePanel'))
  assert(migration.includes('enable row level security'))
  assert(migration.includes('owner_user_id = (select auth.uid())'))
  assert(migration.includes('unique (workspace_id,source_url)'))
})
