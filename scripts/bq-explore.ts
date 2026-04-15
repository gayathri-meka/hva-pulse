import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { runBigQuery } from '../lib/bigquery'

const BILLING_PROJECT = 'hyperverge-chabtbot'
const DATA_PROJECT    = 'sensai-441917'

const QUERY = `
-- Score progression on questions with 3+ attempts
WITH ranked AS (
  SELECT
    course_name, milestone_name, question_title, question_id,
    score, max_score, passed, attempt_at,
    ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY attempt_at ASC) AS attempt_num,
    COUNT(*) OVER (PARTITION BY question_id) AS total_attempts
  FROM \`${DATA_PROJECT}.sensai_prod.pulse_task_question_attempts\`
  WHERE LOWER(learner_name) LIKE '%durgashankar%'
    AND question_type = 'subjective'
    AND course_name IN ('Coding in Python', 'Web Development')
)
SELECT
  course_name,
  milestone_name,
  question_title,
  total_attempts,
  STRING_AGG(
    CAST(CAST(score AS INT64) AS STRING) || '/' || CAST(CAST(max_score AS INT64) AS STRING),
    ' -> ' ORDER BY attempt_num
  ) AS score_progression,
  COUNTIF(passed = TRUE) AS times_passed
FROM ranked
WHERE total_attempts >= 3
GROUP BY course_name, milestone_name, question_title, total_attempts
ORDER BY total_attempts DESC
LIMIT 20
`

async function main() {
  const rows = await runBigQuery(BILLING_PROJECT, QUERY)
  console.log('[bq] ' + rows.length + ' rows')
  for (const row of rows.slice(0, 50)) {
    for (const [k, v] of Object.entries(row)) {
      console.log(k + ': ' + v)
    }
    console.log()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
