-- View: pulse_task_completion_status
--
-- Per-learner per-task derived progression state for HVA learners across the
-- selected coding-track courses. One row per (learner, task) — only emitted
-- when the learner has at least one chat_history event for that task. Pulse
-- treats absence as 'unattempted'.
--
-- Locked-in semantics (see CLAUDE.md):
--   - 'completed'    = every question in the task has been passed
--                      (is_correct = TRUE OR score >= pass_score)
--   - 'attempted'    = at least one question has been answered, but not all
--                      passed
--   - 'unattempted'  = no chat_history rows for any question in the task —
--                      not represented in this view (treat absence as
--                      unattempted in Pulse)
--
-- The 'week' column is the Monday-of-week of the LAST attempt this learner
-- made on any question in this task. That gives us a per-week timeline for
-- "tasks completed in week X".
--
-- Filtering matches view 001 — org_id=4, course IDs (301,319,480,481), quiz
-- tasks only, non-deleted, role='assistant' grader events.

CREATE OR REPLACE VIEW `sensai-441917.sensai_prod.pulse_task_completion_status` AS
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
    -- No course filter — all HVA courses included; filter downstream in Pulse
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
  SELECT
    id AS task_id,
    ANY_VALUE(title) AS task_title
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
-- All non-deleted questions for the in-scope tasks (used to count total questions per task)
q AS (
  SELECT
    id AS question_id,
    ANY_VALUE(task_id) AS task_id
  FROM `sensai-441917.sensai_prod.questions`
  WHERE created_at >= TIMESTAMP('2020-01-01')
    AND deleted_at IS NULL
  GROUP BY id
),
-- Total questions per task (within the in-scope tasks/courses)
task_question_counts AS (
  SELECT
    q.task_id,
    COUNT(*) AS total_questions
  FROM q
  JOIN tk ON tk.task_id = q.task_id
  JOIN ct ON ct.task_id = q.task_id
  JOIN hva_courses c ON c.course_id = ct.course_id
  GROUP BY q.task_id
),
-- All assistant grader events with pass extracted
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
-- Per (user, question): did they ever pass it? When was the last attempt?
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
-- Per (user, task): aggregate question stats and the most recent activity
per_user_task AS (
  SELECT
    puq.user_id,
    q.task_id,
    COUNTIF(TRUE)            AS attempted_questions,
    COUNTIF(puq.passed)      AS passed_questions,
    MAX(puq.last_attempt_at) AS last_attempt_at
  FROM per_user_question puq
  JOIN q ON q.question_id = puq.question_id
  GROUP BY puq.user_id, q.task_id
)
SELECT
  u.email,
  u.learner_name,
  DATE_TRUNC(DATE(put.last_attempt_at), WEEK(MONDAY)) AS week,
  c.course_id,
  c.course_name,
  ct.milestone_id,
  ms.milestone_name,
  put.task_id,
  tk.task_title AS task_name,
  tqc.total_questions,
  put.attempted_questions,
  put.passed_questions,
  put.last_attempt_at,
  CASE
    WHEN put.passed_questions >= tqc.total_questions THEN 'completed'
    WHEN put.attempted_questions > 0                 THEN 'attempted'
    ELSE 'unattempted'
  END AS state
FROM per_user_task put
JOIN task_question_counts tqc ON tqc.task_id = put.task_id
JOIN tk            ON tk.task_id     = put.task_id
JOIN ct            ON ct.task_id     = put.task_id
JOIN hva_courses c ON c.course_id    = ct.course_id
LEFT JOIN ms       ON ms.milestone_id = ct.milestone_id
JOIN hva_users u   ON u.id           = put.user_id
