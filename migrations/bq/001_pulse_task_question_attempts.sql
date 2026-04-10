-- View: pulse_task_question_attempts
--
-- Granular per-question-per-attempt scores for HVA learners across the
-- selected coding-track courses. One row per (learner, question, attempt).
-- Pulse syncs from this view into metric_raw_rows; aggregations to task /
-- week / course happen downstream in the metric layer.
--
-- Scoping (locked-in choices, see CLAUDE.md):
--   - org_id = 4 (HVA / HyperVerge Academy)
--   - course IDs in (301, 319, 480, 481): Coding in Python, Web Development,
--     React, Backend
--   - tasks.type = 'quiz' (we ignore reading material and assignments)
--   - tasks.deleted_at IS NULL, questions.deleted_at IS NULL
--   - chat_history.role = 'assistant' (the AI grader's response, not the
--     learner's submission)
--   - All attempts kept; downstream consumers can pick latest/best.
--
-- Score extraction follows the pattern in learner_assessment_data:
-- COALESCE($.score, $.scorecard[0].score). Likewise for max_score and
-- pass_score. Objective questions surface $.is_correct instead.
--
-- Several tables in sensai_prod have duplicate rows with the same primary
-- key (courses, chat_history, questions). Every CTE here dedups via
-- GROUP BY id + ANY_VALUE(...).

CREATE OR REPLACE VIEW `sensai-441917.sensai_prod.pulse_task_question_attempts` AS
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
    ANY_VALUE(title) AS task_title,
    ANY_VALUE(type)  AS task_type
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
    ANY_VALUE(task_id)  AS task_id,
    ANY_VALUE(type)     AS question_type,
    ANY_VALUE(position) AS question_position,
    ANY_VALUE(title)    AS question_title
  FROM `sensai-441917.sensai_prod.questions`
  WHERE created_at >= TIMESTAMP('2020-01-01')
    AND deleted_at IS NULL
  GROUP BY id
),
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
        JSON_EXTRACT_SCALAR(ch.content, '$.max_score'),
        JSON_EXTRACT_SCALAR(JSON_EXTRACT_ARRAY(ch.content, '$.scorecard')[SAFE_OFFSET(0)], '$.max_score')
      ) AS FLOAT64
    ) AS max_score,
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
)
SELECT
  u.email,
  u.learner_name,
  DATE_TRUNC(DATE(g.attempt_at), WEEK(MONDAY)) AS week,
  c.course_id,
  c.course_name,
  ct.milestone_id,
  ms.milestone_name,
  q.task_id,
  tk.task_title AS task_name,
  tk.task_type,
  g.question_id,
  q.question_position,
  q.question_type,
  q.question_title,
  g.attempt_at,
  g.score,
  g.max_score,
  g.pass_score,
  SAFE_DIVIDE(g.score, g.max_score) AS normalized_score,
  g.is_correct,
  CASE
    WHEN g.is_correct IS NOT NULL THEN g.is_correct
    WHEN g.score IS NOT NULL AND g.pass_score IS NOT NULL THEN g.score >= g.pass_score
    ELSE NULL
  END AS passed
FROM graded g
JOIN q             ON q.question_id  = g.question_id
JOIN tk            ON tk.task_id     = q.task_id
JOIN ct            ON ct.task_id     = q.task_id
JOIN hva_courses c ON c.course_id    = ct.course_id
LEFT JOIN ms       ON ms.milestone_id = ct.milestone_id
JOIN hva_users u   ON u.id           = g.user_id
