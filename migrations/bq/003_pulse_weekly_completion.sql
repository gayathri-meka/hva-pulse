-- View: pulse_weekly_completion
--
-- The ONLY view Pulse syncs from. Aggregates to (learner, week, course,
-- milestone) — one row per combination. Designed to be small (~5-10k rows)
-- so syncs into Supabase metric_raw_rows are fast and storage stays lean.
--
-- Columns:
--   email, learner_name       — join key + display name
--   week                      — Monday of the ISO week (DATE)
--   course_id, course_name    — course info
--   milestone_id, milestone_name — milestone info (nullable)
--   tasks_attempted           — # distinct tasks where learner answered ≥1 question
--   tasks_completed           — # distinct tasks where learner passed ALL questions
--   questions_attempted       — # distinct questions learner answered (any attempt)
--   questions_passed          — # distinct questions learner passed
--
-- No hardcoded course list — includes all HVA courses (org_id = 4). Course
-- filtering happens in Pulse via dimension filters on the metric definition.
--
-- Dedup: all base tables are GROUP BY id + ANY_VALUE to handle duplicate rows
-- in sensai_prod. chat_history is SELECT DISTINCT.

CREATE OR REPLACE VIEW `sensai-441917.sensai_prod.pulse_weekly_completion` AS
WITH
hva_users AS (
  SELECT
    id,
    ANY_VALUE(LOWER(TRIM(email))) AS email,
    ANY_VALUE(TRIM(CONCAT(COALESCE(first_name,''), ' ', COALESCE(last_name,'')))) AS learner_name
  FROM `sensai-441917.sensai_prod.users`
  WHERE created_at >= TIMESTAMP('2020-01-01')
  GROUP BY id
),
hva_courses AS (
  SELECT id AS course_id, ANY_VALUE(name) AS course_name
  FROM `sensai-441917.sensai_prod.courses`
  WHERE created_at >= TIMESTAMP('2020-01-01')
    AND org_id = 4
  GROUP BY id
),
ct AS (
  SELECT
    task_id,
    ANY_VALUE(course_id)    AS course_id,
    ANY_VALUE(milestone_id) AS milestone_id
  FROM `sensai-441917.sensai_prod.course_tasks`
  WHERE created_at >= TIMESTAMP('2020-01-01')
  GROUP BY task_id
),
tk AS (
  SELECT id AS task_id
  FROM `sensai-441917.sensai_prod.tasks`
  WHERE created_at >= TIMESTAMP('2020-01-01')
    AND deleted_at IS NULL
    AND LOWER(type) = 'quiz'
  GROUP BY id
),
ms AS (
  SELECT id AS milestone_id, ANY_VALUE(name) AS milestone_name
  FROM `sensai-441917.sensai_prod.milestones`
  GROUP BY id
),
q AS (
  SELECT
    id AS question_id,
    ANY_VALUE(task_id) AS task_id
  FROM `sensai-441917.sensai_prod.questions`
  WHERE created_at >= TIMESTAMP('2020-01-01')
    AND deleted_at IS NULL
  GROUP BY id
),
-- Total questions per task (for "completed" derivation)
task_question_counts AS (
  SELECT q.task_id, COUNT(*) AS total_questions
  FROM q
  JOIN tk ON tk.task_id = q.task_id
  JOIN ct ON ct.task_id = q.task_id
  JOIN hva_courses c ON c.course_id = ct.course_id
  GROUP BY q.task_id
),
-- Per (user, question): did they ever pass? Which week was their last attempt?
graded AS (
  SELECT DISTINCT
    ch.user_id,
    ch.question_id,
    ch.created_at AS attempt_at,
    SAFE_CAST(
      COALESCE(
        JSON_EXTRACT_SCALAR(ch.content, '$.score'),
        JSON_EXTRACT_SCALAR(JSON_EXTRACT_ARRAY(ch.content, '$.scorecard')[SAFE_OFFSET(0)], '$.score')
      ) AS FLOAT64
    ) AS score,
    SAFE_CAST(
      COALESCE(
        JSON_EXTRACT_SCALAR(ch.content, '$.pass_score'),
        JSON_EXTRACT_SCALAR(JSON_EXTRACT_ARRAY(ch.content, '$.scorecard')[SAFE_OFFSET(0)], '$.pass_score')
      ) AS FLOAT64
    ) AS pass_score,
    SAFE_CAST(JSON_EXTRACT_SCALAR(ch.content, '$.is_correct') AS BOOL) AS is_correct
  FROM `sensai-441917.sensai_prod.chat_history` ch
  WHERE ch.created_at >= TIMESTAMP('2024-01-01')
    AND ch.role = 'assistant'
),
per_user_question AS (
  SELECT
    g.user_id,
    g.question_id,
    LOGICAL_OR(
      CASE
        WHEN g.is_correct IS NOT NULL THEN g.is_correct
        WHEN g.score IS NOT NULL AND g.pass_score IS NOT NULL THEN g.score >= g.pass_score
        ELSE FALSE
      END
    ) AS passed,
    MAX(g.attempt_at) AS last_attempt_at
  FROM graded g
  GROUP BY g.user_id, g.question_id
),
-- Per (user, task): question stats + completion state
per_user_task AS (
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
-- Tag each (user, task) with week + course + milestone + completion state
user_task_enriched AS (
  SELECT
    put.user_id,
    put.task_id,
    ct.course_id,
    ct.milestone_id,
    DATE_TRUNC(DATE(put.last_attempt_at), WEEK(MONDAY)) AS week,
    1 AS is_attempted,
    CASE WHEN put.passed_questions >= tqc.total_questions THEN 1 ELSE 0 END AS is_completed,
    put.attempted_questions,
    put.passed_questions
  FROM per_user_task put
  JOIN task_question_counts tqc ON tqc.task_id = put.task_id
  JOIN tk ON tk.task_id = put.task_id
  JOIN ct ON ct.task_id = put.task_id
  JOIN hva_courses c ON c.course_id = ct.course_id
)
-- Final aggregation: per (learner, week, course, milestone)
SELECT
  u.email,
  u.learner_name,
  ute.week,
  ute.course_id,
  c.course_name,
  ute.milestone_id,
  ms.milestone_name,
  SUM(ute.is_attempted)          AS tasks_attempted,
  SUM(ute.is_completed)          AS tasks_completed,
  SUM(ute.attempted_questions)   AS questions_attempted,
  SUM(ute.passed_questions)      AS questions_passed
FROM user_task_enriched ute
JOIN hva_users u   ON u.id           = ute.user_id
JOIN hva_courses c ON c.course_id    = ute.course_id
LEFT JOIN ms       ON ms.milestone_id = ute.milestone_id
GROUP BY
  u.email, u.learner_name, ute.week,
  ute.course_id, c.course_name,
  ute.milestone_id, ms.milestone_name
