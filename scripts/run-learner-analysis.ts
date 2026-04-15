/**
 * Learner analysis pipeline.
 *
 * 1. Fetches target learners from Supabase (July sub-cohort, Ongoing)
 * 2. Runs broad BQ aggregates for all of them at once
 * 3. Stores raw_data per learner in learner_analysis table
 *
 * Usage:
 *   npx tsx scripts/run-learner-analysis.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createClient } from '@supabase/supabase-js'
import { runBigQuery } from '../lib/bigquery'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BQ_BILLING   = 'hyperverge-chabtbot'
const BQ_DATA      = 'sensai-441917'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Step 1: Get target learners ──────────────────────────────────────────────

async function getTargetLearners(): Promise<{ learner_id: string; email: string; name: string }[]> {
  const { data, error } = await supabase
    .from('learners')
    .select('learner_id, sub_cohort, status, users!learners_user_id_fkey(email, name)')
    .eq('sub_cohort', 'July')
    .eq('status', 'Ongoing')

  if (error) throw new Error('Supabase error: ' + error.message)
  if (!data || data.length === 0) throw new Error('No learners found')

  return data.map((l: any) => ({
    learner_id: l.learner_id,
    email:      (l.users?.email ?? '').trim().toLowerCase(),
    name:       l.users?.name ?? l.learner_id,
  })).filter((l: any) => l.email)
}

// ── Step 2: BQ queries ───────────────────────────────────────────────────────

function emailList(emails: string[]): string {
  return emails.map((e) => "'" + e.replace(/'/g, "\\'") + "'").join(',')
}

async function queryCourseSummary(emails: string[]) {
  const q = `
    WITH ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY email, question_id ORDER BY attempt_at ASC) AS attempt_num
      FROM \`${BQ_DATA}.sensai_prod.pulse_task_question_attempts\`
      WHERE LOWER(email) IN (${emailList(emails)})
    )
    SELECT
      email,
      course_name,
      question_type,
      COUNT(*) AS total_attempts,
      COUNT(DISTINCT question_id) AS distinct_questions,
      COUNTIF(passed = TRUE) AS passed_attempts,
      COUNTIF(attempt_num = 1) AS total_first_attempts,
      COUNTIF(attempt_num = 1 AND passed = TRUE) AS first_attempt_passed,
      ROUND(SAFE_DIVIDE(COUNTIF(attempt_num = 1 AND passed = TRUE), COUNTIF(attempt_num = 1)) * 100, 1) AS first_attempt_pass_rate,
      ROUND(AVG(CASE WHEN attempt_num = 1 AND normalized_score IS NOT NULL THEN normalized_score END) * 100, 1) AS avg_first_score,
      COUNTIF(attempt_num > 1) AS retries,
      COUNT(DISTINCT CASE WHEN attempt_num = 1 THEN question_id END) - COUNT(DISTINCT CASE WHEN attempt_num = 1 AND passed = TRUE THEN question_id END) AS questions_never_first_passed
    FROM ranked
    GROUP BY email, course_name, question_type
    ORDER BY email, course_name, question_type
  `
  return runBigQuery(BQ_BILLING, q)
}

async function queryWeakestAreas(emails: string[]) {
  const q = `
    WITH ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY email, question_id ORDER BY attempt_at ASC) AS attempt_num
      FROM \`${BQ_DATA}.sensai_prod.pulse_task_question_attempts\`
      WHERE LOWER(email) IN (${emailList(emails)})
        AND question_type = 'subjective'
    ),
    first AS (
      SELECT * FROM ranked WHERE attempt_num = 1
    )
    SELECT
      email,
      course_name,
      milestone_name,
      COUNT(*) AS questions,
      COUNTIF(passed = TRUE) AS first_pass,
      ROUND(SAFE_DIVIDE(COUNTIF(passed = TRUE), COUNT(*)) * 100, 1) AS first_pass_rate,
      ROUND(AVG(CASE WHEN normalized_score IS NOT NULL THEN normalized_score END) * 100, 1) AS avg_first_score
    FROM first
    GROUP BY email, course_name, milestone_name
    HAVING COUNT(*) >= 3
    ORDER BY email, first_pass_rate ASC
  `
  return runBigQuery(BQ_BILLING, q)
}

async function queryScoreProgressions(emails: string[]) {
  const q = `
    WITH ranked AS (
      SELECT
        email, course_name, milestone_name, question_title, question_id,
        score, max_score, passed, attempt_at,
        ROW_NUMBER() OVER (PARTITION BY email, question_id ORDER BY attempt_at ASC) AS attempt_num,
        COUNT(*) OVER (PARTITION BY email, question_id) AS total_attempts
      FROM \`${BQ_DATA}.sensai_prod.pulse_task_question_attempts\`
      WHERE LOWER(email) IN (${emailList(emails)})
        AND question_type = 'subjective'
    )
    SELECT
      email,
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
    GROUP BY email, course_name, milestone_name, question_title, total_attempts
    ORDER BY email, total_attempts DESC
  `
  return runBigQuery(BQ_BILLING, q)
}

async function queryFeedbackSamples(emails: string[]) {
  const q = `
    WITH u AS (
      SELECT id, ANY_VALUE(LOWER(TRIM(email))) AS email
      FROM \`${BQ_DATA}.sensai_prod.users\`
      WHERE created_at >= TIMESTAMP('2020-01-01')
        AND LOWER(TRIM(email)) IN (${emailList(emails)})
      GROUP BY id
    ),
    failed_first AS (
      SELECT a.email, a.question_id, a.course_name, a.milestone_name,
             a.question_title, a.score, a.max_score, a.attempt_at
      FROM \`${BQ_DATA}.sensai_prod.pulse_task_question_attempts\` a
      WHERE LOWER(a.email) IN (${emailList(emails)})
        AND a.passed = FALSE
        AND a.question_type = 'subjective'
    ),
    fb AS (
      SELECT DISTINCT
        u.email,
        ch.question_id,
        ch.created_at,
        JSON_EXTRACT_SCALAR(
          JSON_EXTRACT_ARRAY(ch.content, '$.scorecard')[SAFE_OFFSET(0)],
          '$.feedback.wrong'
        ) AS wrong_feedback
      FROM \`${BQ_DATA}.sensai_prod.chat_history\` ch
      JOIN u ON u.id = ch.user_id
      WHERE ch.created_at >= TIMESTAMP('2024-01-01')
        AND ch.role = 'assistant'
    )
    SELECT
      f.email,
      f.course_name,
      f.milestone_name,
      f.question_title,
      CAST(CAST(f.score AS INT64) AS STRING) || '/' || CAST(CAST(f.max_score AS INT64) AS STRING) AS score,
      fb.wrong_feedback
    FROM failed_first f
    LEFT JOIN fb ON fb.email = f.email
      AND fb.question_id = f.question_id
      AND ABS(TIMESTAMP_DIFF(fb.created_at, f.attempt_at, SECOND)) < 10
    WHERE fb.wrong_feedback IS NOT NULL
      AND fb.wrong_feedback != 'null'
      AND LENGTH(fb.wrong_feedback) > 10
    ORDER BY f.email, f.course_name
  `
  return runBigQuery(BQ_BILLING, q)
}

async function queryActivityTimeline(emails: string[]) {
  const q = `
    SELECT
      email,
      DATE_TRUNC(DATE(attempt_at), WEEK(MONDAY)) AS week,
      course_name,
      COUNT(*) AS attempts,
      COUNTIF(passed = TRUE) AS passed,
      COUNT(DISTINCT question_id) AS distinct_questions
    FROM \`${BQ_DATA}.sensai_prod.pulse_task_question_attempts\`
    WHERE LOWER(email) IN (${emailList(emails)})
    GROUP BY email, week, course_name
    ORDER BY email, week DESC
  `
  return runBigQuery(BQ_BILLING, q)
}

// ── Step 3: Group by email and store ─────────────────────────────────────────

function groupByEmail<T extends Record<string, string | null>>(rows: T[], key = 'email'): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const email = (row[key] ?? '').toLowerCase()
    if (!email) continue
    if (!map.has(email)) map.set(email, [])
    map.get(email)!.push(row)
  }
  return map
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[analysis] Fetching target learners from Supabase...')
  const learners = await getTargetLearners()
  console.log('[analysis] Found ' + learners.length + ' learners')

  const emails = learners.map((l) => l.email)

  console.log('[analysis] Running BQ queries (this may take a few minutes)...')

  const [courseSummary, weakestAreas, progressions, feedback, activity] = await Promise.all([
    queryCourseSummary(emails).then((r) => { console.log('  course_summary: ' + r.length + ' rows'); return r }),
    queryWeakestAreas(emails).then((r) => { console.log('  weakest_areas: ' + r.length + ' rows'); return r }),
    queryScoreProgressions(emails).then((r) => { console.log('  progressions: ' + r.length + ' rows'); return r }),
    queryFeedbackSamples(emails).then((r) => { console.log('  feedback: ' + r.length + ' rows'); return r }),
    queryActivityTimeline(emails).then((r) => { console.log('  activity: ' + r.length + ' rows'); return r }),
  ])

  const byCourse    = groupByEmail(courseSummary)
  const byWeak      = groupByEmail(weakestAreas)
  const byProg      = groupByEmail(progressions)
  const byFeedback  = groupByEmail(feedback)
  const byActivity  = groupByEmail(activity)

  console.log('[analysis] Storing results in Supabase...')

  let stored = 0
  for (const learner of learners) {
    const email = learner.email
    const rawData = {
      course_summary:     byCourse.get(email) ?? [],
      weakest_areas:      byWeak.get(email) ?? [],
      score_progressions: byProg.get(email) ?? [],
      feedback_samples:   byFeedback.get(email) ?? [],
      activity_timeline:  byActivity.get(email) ?? [],
    }

    // Sanitize: remove invalid Unicode escape sequences that Postgres rejects
    const sanitized = JSON.parse(
      JSON.stringify(rawData).replace(/\\u0000/g, '')
    )

    const { error } = await supabase
      .from('learner_analysis')
      .upsert({
        learner_id:    learner.learner_id,
        email:         email,
        raw_data:      sanitized,
        computed_at:   new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      })

    if (error) {
      console.error('  FAILED for ' + learner.name + ': ' + error.message)
    } else {
      stored++
    }
  }

  console.log('[analysis] Done. Stored raw data for ' + stored + '/' + learners.length + ' learners.')
}

main().catch((e) => {
  console.error('[analysis] FAILED:', e)
  process.exit(1)
})
