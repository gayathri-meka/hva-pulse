import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'

// The 14-Day Challenge lives on SensAI (our LMS). Days = course milestones,
// ordered by course_milestones.ordering. See migrations/bq notes + CLAUDE.md.
export const CHALLENGE_COURSE_ID = 587
export const CHALLENGE_COHORT_ID = 214

// How long a fetched progress snapshot is considered fresh (keeps the challenge
// page fast and avoids hammering SensAI's DB on every view).
const CACHE_TTL_MS = 10 * 60 * 1000

export type DayProgress = {
  day_ordering:    number
  day_name:        string
  total_tasks:     number
  completed_tasks: number
}

let pool: Pool | null = null
function getPool(): Pool | null {
  const url = process.env.SENSAI_DATABASE_URL
  if (!url) return null
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false }, // managed PG over public internet + SSL
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    })
  }
  return pool
}

// Per (learner, day) completion for the challenge course. A task is "done":
//   learning_material / assignment -> a task_completions row exists for the user
//   quiz                           -> every question in the task has a passing
//                                     grade in chat_history (score >= pass_score)
// Denominator counts published, non-deleted tasks only. Params: $1 email, $2 course_id.
const PROGRESS_SQL = `
WITH learner AS (
  SELECT id AS user_id
  FROM users
  WHERE lower(trim(email)) = lower(trim($1))
  LIMIT 1
),
day_tasks AS (
  SELECT cm.ordering AS day_ordering, m.name AS day_name, t.id AS task_id, t.type AS task_type
  FROM course_tasks ct
  JOIN tasks t            ON t.id = ct.task_id AND t.status = 'published' AND t.deleted_at IS NULL
  JOIN course_milestones cm ON cm.milestone_id = ct.milestone_id AND cm.course_id = ct.course_id
  JOIN milestones m       ON m.id = ct.milestone_id
  WHERE ct.course_id = $2
),
-- learning_material / assignment: any completion row by this learner
lm_done AS (
  SELECT DISTINCT tc.task_id
  FROM task_completions tc, learner l
  WHERE tc.user_id = l.user_id
),
-- questions belonging to this course's quiz tasks
quiz_q AS (
  SELECT q.task_id, q.id AS question_id
  FROM questions q
  JOIN day_tasks dt ON dt.task_id = q.task_id AND dt.task_type = 'quiz'
),
-- latest assistant grade per quiz question for this learner
graded AS (
  SELECT ch.question_id,
         COALESCE(
           (ch.content::jsonb ->> 'score')::float8,
           (ch.content::jsonb -> 'scorecard' -> 0 ->> 'score')::float8
         ) AS score,
         COALESCE(
           (ch.content::jsonb ->> 'pass_score')::float8,
           (ch.content::jsonb -> 'scorecard' -> 0 ->> 'pass_score')::float8
         ) AS pass_score,
         row_number() OVER (PARTITION BY ch.question_id ORDER BY ch.created_at DESC) AS rn
  FROM chat_history ch, learner l
  WHERE ch.role = 'assistant'
    AND ch.user_id = l.user_id
    AND ch.question_id IN (SELECT question_id FROM quiz_q)
),
quiz_passed AS (
  SELECT question_id FROM graded WHERE rn = 1 AND score IS NOT NULL AND pass_score IS NOT NULL AND score >= pass_score
),
-- a quiz task is done when all its questions are passed
quiz_done AS (
  SELECT qq.task_id
  FROM quiz_q qq
  LEFT JOIN quiz_passed qp ON qp.question_id = qq.question_id
  GROUP BY qq.task_id
  HAVING COUNT(*) = COUNT(qp.question_id)
),
task_done AS (
  SELECT dt.day_ordering, dt.day_name, dt.task_id,
    CASE
      WHEN dt.task_type IN ('learning_material', 'assignment') THEN dt.task_id IN (SELECT task_id FROM lm_done)
      WHEN dt.task_type = 'quiz'                                THEN dt.task_id IN (SELECT task_id FROM quiz_done)
      ELSE false
    END AS done
  FROM day_tasks dt
)
SELECT day_ordering,
       day_name,
       COUNT(*)                       AS total_tasks,
       COUNT(*) FILTER (WHERE done)   AS completed_tasks
FROM task_done
GROUP BY day_ordering, day_name
ORDER BY day_ordering
`

/** Live fetch straight from SensAI's DB. Returns null if not configured or on error. */
export async function fetchChallengeProgress(email: string): Promise<DayProgress[] | null> {
  const p = getPool()
  if (!p) return null
  try {
    const res = await p.query(PROGRESS_SQL, [email, CHALLENGE_COURSE_ID])
    return res.rows.map((r) => ({
      day_ordering:    Number(r.day_ordering),
      day_name:        String(r.day_name),
      total_tasks:     Number(r.total_tasks),
      completed_tasks: Number(r.completed_tasks),
    }))
  } catch (e) {
    console.error('[sensai] challenge progress fetch failed:', e)
    return null
  }
}

/**
 * Cached read: serves a recent snapshot from Pulse's own DB when fresh, otherwise
 * fetches live from SensAI and refreshes the snapshot. Falls back to a stale
 * snapshot if the live fetch fails. Returns null only when we have nothing.
 */
export async function getChallengeProgress(email: string): Promise<DayProgress[] | null> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  let stale: DayProgress[] | null = null
  try {
    const { data } = await admin
      .from('sensai_challenge_progress')
      .select('data, fetched_at')
      .eq('email', email)
      .maybeSingle()
    if (data) {
      stale = data.data as DayProgress[]
      if (Date.now() - new Date(data.fetched_at).getTime() < CACHE_TTL_MS) {
        return stale // fresh enough
      }
    }
  } catch {
    // cache table may not exist yet — fall through to a live fetch
  }

  const fresh = await fetchChallengeProgress(email)
  if (fresh) {
    try {
      await admin
        .from('sensai_challenge_progress')
        .upsert(
          { email, data: fresh, fetched_at: new Date().toISOString() },
          { onConflict: 'email' },
        )
    } catch {
      // caching is best-effort
    }
    return fresh
  }

  return stale // live failed — serve stale if we have it, else null
}
