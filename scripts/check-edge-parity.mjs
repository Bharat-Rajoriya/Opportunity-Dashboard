#!/usr/bin/env node
// Offline deployment audit. Use a trusted export of a *deployed* Supabase
// function's index.ts, not a second copy of the GitHub working tree.
// Example: node scripts/check-edge-parity.mjs qualify-manual-capture /tmp/live/index.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

const approved = new Set(['qualify-manual-capture', 'verify-manual-freelancer-source'])
const [slug, deployedPath] = process.argv.slice(2)
if (!approved.has(slug) || !deployedPath) {
  console.error('Usage: node scripts/check-edge-parity.mjs <approved-slug> <deployed-index.ts>')
  process.exitCode = 2
} else {
  try {
    const expected = readFileSync(resolve('supabase', 'functions', slug, 'index.ts'))
    const deployed = readFileSync(resolve(deployedPath))
    const sha = buffer => createHash('sha256').update(buffer).digest('hex')
    if (!expected.equals(deployed)) {
      console.error(`DRIFT ${slug}: repository sha256=${sha(expected)} deployed sha256=${sha(deployed)}`)
      process.exitCode = 1
    } else {
      console.log(`MATCH ${slug}: sha256=${sha(expected)}`)
    }
  } catch (error) {
    console.error(`PARITY_CHECK_FAILED: ${error.message}`)
    process.exitCode = 2
  }
}
