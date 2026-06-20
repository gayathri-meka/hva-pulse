-- View: pulse_challenge_task_status
--
-- Per (cohort member, task) completion state for a SensAI "challenge" course —
-- powers the Admissions → Challenge tab (day/milestone breakdown, per-learner
-- task drill-down, and the cohort-per-day rollup).
--
-- Unlike pulse_task_completion_status (002), this view:
--   - CROSS-JOINS the full cohort roster × the full course task list, so members
--     with zero activity AND tasks not yet done both appear (the denominator is
--     the whole challenge, not just what was touched).
--   - Includes ALL task types (reading material + quiz), not quiz-only.
--   - Carries milestone ("day") + task ordering so Pulse renders days in order.
--
-- Scope: the challenges listed in the `challenge_map` CTE below. course_cohorts
-- (the course<->cohort link) is NOT mirrored to BigQuery, so each challenge's
-- (cohort_id, course_id) pairing is listed explicitly — add a row per new
-- challenge. Pulse can still filter to one via cohort_id / course_id.
--
-- Completion definition (locked-in, CLAUDE.md):
--   quiz task      -> 'completed' when every question is passed (is_correct OR score >= pass_score)
--   reading/other  -> 'completed' when a task_completions row exists for the task
--   'attempted'    -> some activity (a question answered, or a completion row) but not complete
--   'not_started'  -> no activity at all
--
-- BQ base tables have duplicate rows (upsert mirroring) — every CTE dedups via
-- GROUP BY id / SELECT DISTINCT.

CREATE OR REPLACE VIEW `sensai-441917.sensai_prod.pulse_challenge_task_status` AS
WITH
hva_users AS (
  SELECT
    id,
    ANY_VALUE(LOWER(TRIM(email))) AS email,
    ANY_VALUE(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) AS learner_name
  FROM `sensai-441917.sensai_prod.users`
  WHERE created_at >= TIMESTAMP('2020-01-01')   -- partition filter
  GROUP BY id
),
-- Known challenge (cohort, course) pairings. course_cohorts isn't in BigQuery,
-- so list each challenge explicitly. Add a row per new challenge cohort.
challenge_map AS (
  SELECT 214 AS cohort_id, 587 AS course_id   -- 14-Day Challenge (2026), HVA Screening 2026
),
-- Cohort rosters paired to the challenge course: one row per (course, cohort, member).
-- joined_at = when the learner joined the SensAI cohort (user_cohorts.joined_at);
-- powers the "Joined SensAI per week" trend in Admissions → Analytics. MIN() collapses
-- BQ mirror duplicates to the earliest join timestamp.
member_course AS (
  SELECT
    m.course_id,
    uc.cohort_id,
    uc.user_id,
    MIN(uc.joined_at) AS joined_at
  FROM challenge_map m
  JOIN `sensai-441917.sensai_prod.user_cohorts` uc
    ON uc.cohort_id = m.cohort_id
  WHERE uc.deleted_at IS NULL
    AND LOWER(uc.role) = 'learner'
  GROUP BY m.course_id, uc.cohort_id, uc.user_id
),
-- Full task catalog per course (all task types, with milestone + ordering).
catalog AS (
  SELECT
    ct.course_id,
    ct.task_id,
    ANY_VALUE(ct.milestone_id) AS milestone_id,
    ANY_VALUE(ct.ordering)     AS task_ordering,
    ANY_VALUE(t.title)         AS task_title,
    ANY_VALUE(LOWER(t.type))   AS task_type
  FROM `sensai-441917.sensai_prod.course_tasks` ct
  JOIN `sensai-441917.sensai_prod.tasks` t
    ON t.id = ct.task_id
  WHERE t.deleted_at IS NULL          -- course_tasks has no deleted_at in BQ
    AND t.status = 'published'        -- see note below
    AND t.org_id = 4
    AND ct.created_at >= TIMESTAMP('2020-01-01')  -- partition filters
    AND t.created_at  >= TIMESTAMP('2020-01-01')
  GROUP BY ct.course_id, ct.task_id
),
-- status = 'published' is load-bearing, NOT just cosmetic. Task deletions in SensAI
-- do NOT reliably propagate to the BQ mirror as `deleted_at` (verified 2026-06-18:
-- 'Test', 'New quiz', 'New learning material' placeholders were deleted before the
-- mirror ran yet still showed deleted_at = NULL). Those leftovers are all status =
-- 'draft', as are not-yet-published work-in-progress days. Filtering to 'published'
-- both drops the orphaned placeholders AND scopes the denominator to what learners
-- can actually see — the correct base for a live challenge's completion %.
courses AS (
  SELECT id AS course_id, ANY_VALUE(name) AS course_name
  FROM `sensai-441917.sensai_prod.courses`
  WHERE org_id = 4
    AND created_at >= TIMESTAMP('2020-01-01')   -- partition filter
  GROUP BY id
),
milestone_names AS (
  SELECT id AS milestone_id, ANY_VALUE(name) AS milestone_name
  FROM `sensai-441917.sensai_prod.milestones`
  GROUP BY id
),
-- Milestone ("day") order within a course.
course_ms AS (
  SELECT course_id, milestone_id, ANY_VALUE(ordering) AS milestone_ordering
  FROM `sensai-441917.sensai_prod.course_milestones`
  WHERE created_at >= TIMESTAMP('2020-01-01')   -- partition filter
  GROUP BY course_id, milestone_id
),
-- Questions per task (for quiz totals; reading tasks have 0).
q AS (
  SELECT id AS question_id, ANY_VALUE(task_id) AS task_id
  FROM `sensai-441917.sensai_prod.questions`
  WHERE deleted_at IS NULL
    AND created_at >= TIMESTAMP('2020-01-01')   -- partition filter
  GROUP BY id
),
task_question_counts AS (
  SELECT task_id, COUNT(*) AS total_questions
  FROM q
  GROUP BY task_id
),
-- Quiz grading (same score-extraction recipe as view 002).
graded AS (
  SELECT DISTINCT
    ch.user_id,
    ch.question_id,
    ch.created_at AS attempt_at,
    SAFE_CAST(COALESCE(
      JSON_EXTRACT_SCALAR(ch.content, '$.score'),
      JSON_EXTRACT_SCALAR(JSON_EXTRACT_ARRAY(ch.content, '$.scorecard')[SAFE_OFFSET(0)], '$.score')
    ) AS FLOAT64) AS score,
    SAFE_CAST(COALESCE(
      JSON_EXTRACT_SCALAR(ch.content, '$.pass_score'),
      JSON_EXTRACT_SCALAR(JSON_EXTRACT_ARRAY(ch.content, '$.scorecard')[SAFE_OFFSET(0)], '$.pass_score')
    ) AS FLOAT64) AS pass_score,
    SAFE_CAST(JSON_EXTRACT_SCALAR(ch.content, '$.is_correct') AS BOOL) AS is_correct
  FROM `sensai-441917.sensai_prod.chat_history` ch
  WHERE ch.role = 'assistant'
    AND ch.created_at >= TIMESTAMP('2024-01-01')
),
per_user_question AS (
  SELECT
    g.user_id,
    g.question_id,
    LOGICAL_OR(CASE
      WHEN g.is_correct IS NOT NULL THEN g.is_correct
      WHEN g.score IS NOT NULL AND g.pass_score IS NOT NULL THEN g.score >= g.pass_score
      ELSE FALSE
    END) AS passed,
    MAX(g.attempt_at) AS last_attempt_at
  FROM graded g
  GROUP BY g.user_id, g.question_id
),
per_user_task_quiz AS (
  SELECT
    puq.user_id,
    q.task_id,
    COUNT(*)            AS attempted_questions,
    COUNTIF(puq.passed) AS passed_questions,
    MAX(puq.last_attempt_at) AS last_attempt_at
  FROM per_user_question puq
  JOIN q ON q.question_id = puq.question_id
  GROUP BY puq.user_id, q.task_id
),
-- Reading / non-quiz completion + any-activity signal (task_id set on these rows).
per_user_task_completion AS (
  SELECT
    user_id,
    task_id,
    MAX(created_at) AS last_completion_at
  FROM `sensai-441917.sensai_prod.task_completions`
  WHERE created_at >= TIMESTAMP('2024-01-01')  -- partition filter (required); no deleted_at in BQ
    AND task_id IS NOT NULL
  GROUP BY user_id, task_id
)
SELECT
  mc.cohort_id,
  mc.course_id,
  co.course_name,
  mc.joined_at,
  u.email,
  u.learner_name,
  cat.milestone_id,
  mn.milestone_name,
  cms.milestone_ordering,
  cat.task_id,
  cat.task_title,
  cat.task_ordering,
  cat.task_type,
  COALESCE(tqc.total_questions, 0)      AS total_questions,
  COALESCE(putq.attempted_questions, 0) AS attempted_questions,
  COALESCE(putq.passed_questions, 0)    AS passed_questions,
  (putc.task_id IS NOT NULL)            AS has_task_completion,
  CASE
    WHEN COALESCE(tqc.total_questions, 0) > 0 THEN
      CASE
        WHEN putq.passed_questions >= tqc.total_questions                  THEN 'completed'
        WHEN COALESCE(putq.attempted_questions, 0) > 0 OR putc.task_id IS NOT NULL THEN 'attempted'
        ELSE 'not_started'
      END
    ELSE
      CASE WHEN putc.task_id IS NOT NULL THEN 'completed' ELSE 'not_started' END
  END AS state,
  (SELECT MAX(x) FROM UNNEST([putq.last_attempt_at, putc.last_completion_at]) AS x) AS last_activity_at
FROM member_course mc
JOIN catalog cat               ON cat.course_id = mc.course_id
JOIN hva_users u               ON u.id = mc.user_id
JOIN courses co                ON co.course_id = mc.course_id
LEFT JOIN milestone_names mn   ON mn.milestone_id = cat.milestone_id
LEFT JOIN course_ms cms        ON cms.course_id = mc.course_id AND cms.milestone_id = cat.milestone_id
LEFT JOIN task_question_counts tqc ON tqc.task_id = cat.task_id
LEFT JOIN per_user_task_quiz putq  ON putq.user_id = mc.user_id AND putq.task_id = cat.task_id
LEFT JOIN per_user_task_completion putc ON putc.user_id = mc.user_id AND putc.task_id = cat.task_id
