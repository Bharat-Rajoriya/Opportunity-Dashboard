const { pathToFileURL } = require('node:url')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const moduleUrl = pathToFileURL(
  join(__dirname, '../src/config/proofProfiles.js')
).href

test('proof types expose only relevant fields', async () => {
  const {
    getProofTypeConfig,
    isProofFieldVisible,
  } = await import(moduleUrl)

  assert.equal(
    isProofFieldVisible('profile', 'client_name'),
    false
  )
  assert.equal(
    isProofFieldVisible('profile', 'platform'),
    true
  )
  assert.equal(
    isProofFieldVisible('project', 'client_name'),
    true
  )
  assert.equal(
    isProofFieldVisible('testimonial', 'technologies'),
    false
  )
  assert.equal(
    isProofFieldVisible('certification', 'services'),
    false
  )
  assert.equal(
    isProofFieldVisible('publication', 'proof_points'),
    true
  )

  assert(
    getProofTypeConfig('profile').fields.includes(
      'project_url'
    )
  )
})

test('changing proof type clears fields that are no longer relevant', async () => {
  const { changeProofType } = await import(moduleUrl)

  const changed = changeProofType(
    {
      proof_type: 'project',
      platform: 'Website',
      project_name: 'Client project',
      client_name: 'Client',
      industry: 'Retail',
      services: 'Branding',
      technologies: 'Research',
      project_url: 'https://example.com',
      summary: 'Summary',
      proof_points: 'Result',
      active: true,
    },
    'testimonial'
  )

  assert.equal(changed.proof_type, 'testimonial')
  assert.equal(changed.platform, 'Website')
  assert.equal(changed.project_name, 'Client project')
  assert.equal(changed.client_name, 'Client')
  assert.equal(changed.services, 'Branding')
  assert.equal(changed.project_url, 'https://example.com')
  assert.equal(changed.summary, 'Summary')

  assert.equal(changed.industry, '')
  assert.equal(changed.technologies, '')
  assert.equal(changed.proof_points, '')
  assert.equal(changed.active, true)
})

test('proof field labels and placeholders adapt to selected type', async () => {
  const { getProofFieldMeta } = await import(moduleUrl)

  assert.deepEqual(
    getProofFieldMeta('certification', 'platform'),
    {
      label: 'Issuer / Platform',
      placeholder:
        'e.g. professional body, university, certification provider',
    }
  )

  assert.equal(
    getProofFieldMeta('publication', 'project_name').label,
    'Publication Title'
  )

  assert.equal(
    getProofFieldMeta('testimonial', 'summary').label,
    'Testimonial / Context'
  )
})
