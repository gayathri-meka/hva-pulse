/**
 * One-off BigQuery explorer.
 * Edit the QUERY constant and run: npx tsx scripts/bq-explore.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { runBigQuery } from '../lib/bigquery'

const BILLING_PROJECT = 'hyperverge-chabtbot'
const DATA_PROJECT    = 'sensai-441917'
const LIMIT_ROWS = 50

const QUERY = `
SELECT *
FROM \`${DATA_PROJECT}.sensai_prod.pulse_weekly_completion\`
WHERE email = 'aasmachoudhary5@gmail.com'
ORDER BY week DESC
LIMIT 10
`

async function main() {
  const rows = await runBigQuery(BILLING_PROJECT, QUERY)
  const trimmed = rows.slice(0, LIMIT_ROWS)
  console.log(`[bq-explore] returned ${rows.length} rows (showing first ${trimmed.length})`)
  for (const row of trimmed) {
    for (const [k, v] of Object.entries(row)) {
      console.log(`${k}: ${v}`)
    }
    console.log()
  }
}

main().catch((e) => {
  console.error('[bq-explore] FAILED:', e)
  process.exit(1)
})
