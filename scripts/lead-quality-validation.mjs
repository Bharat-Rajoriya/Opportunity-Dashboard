#!/usr/bin/env node
// Offline analysis only. Uses a private, authorized JSON export from Supabase.
// No database updates, network calls, or automated buyer classifications.
import { readFileSync } from 'node:fs'
import { prepareValidationQueue, summarizeValidationFindings } from './lib/lead-quality-findings.mjs'

const [mode, file, n] = process.argv.slice(2)
if (!['findings','queue'].includes(mode) || !file) {
  console.error('Usage: node scripts/lead-quality-validation.mjs <findings|queue> <private-export.json> [per-stratum]')
  process.exit(2)
}
try {
  const input = JSON.parse(readFileSync(file,'utf8'))
  const rows = Array.isArray(input) ? input : input?.data
  if (!Array.isArray(rows)) throw new Error('Expected a JSON array or {data:[...]}')
  const result = mode === 'findings' ? summarizeValidationFindings(rows)
    : prepareValidationQueue(rows, n == null ? 6 : Number(n))
  process.stdout.write(JSON.stringify(result,null,2) + '\n')
} catch (error) {
  console.error('Lead quality validation failed:',error.message)
  process.exitCode = 1
}
