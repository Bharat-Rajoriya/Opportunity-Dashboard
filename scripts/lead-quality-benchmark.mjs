#!/usr/bin/env node
// Read-only, offline quality benchmark. Never uploads records or writes to DB.
// Usage: node scripts/lead-quality-benchmark.mjs <baseline|sample|report> <input.json> [per-stratum]
import { readFileSync } from 'node:fs'
import { stratifiedSample, summarizeReviews, summarizeUnlabeled } from './lib/lead-quality-benchmark.mjs'

const [mode,path,n] = process.argv.slice(2)
if (!['baseline','sample','report'].includes(mode) || !path) {
  console.error('Usage: node scripts/lead-quality-benchmark.mjs <baseline|sample|report> <input.json> [per-stratum]')
  process.exit(2)
}
try {
  const input = JSON.parse(readFileSync(path,'utf8'))
  const rows = Array.isArray(input) ? input : input?.data
  if (!Array.isArray(rows)) throw new Error('Input must be a JSON array or {data:[...]}')
  const output = mode === 'baseline' ? summarizeUnlabeled(rows)
    : mode === 'sample' ? stratifiedSample(rows, n === undefined ? 6 : Number(n))
    : summarizeReviews(rows)
  process.stdout.write(JSON.stringify(output,null,2) + '\n')
} catch (error) {
  console.error('Lead quality audit failed:',error?.message || error)
  process.exitCode = 1
}
