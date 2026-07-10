-- View: pulse_challenge_intake
--
-- One row per (cohort member) with their LATEST raw answer to each of the
-- challenge intake questions that feed the "eligibility" review criteria. Powers
-- the challenge→interview selection gate (Admissions → Challenge → Review).
--
-- Deliberately emits RAW answer text (not parsed). The messy parsing (option
-- letters → meaning, salary free-text → number, year extraction, FT/PT inference)
-- lives in Pulse (`lib/challengeIntake.ts`) where it's unit-tested — the view just
-- pivots the latest answer per question to a column.
--
-- Question IDs are specific to course 587 (14-Day Challenge 2026); a new challenge
-- with re-authored questions needs its own ID mapping. Verified prompts (2026):
--   34069 "Are you currently studying…?"            a=Yes b=No
--   34070 "current education level"                 a=Class12 b=Bachelor c=Master d=Diploma e=Other f=NA
--   34073 "name of your current college…"           free text / Not Applicable
--   34074 "In which year will you complete…"        year e.g. 2026 / Not Applicable
--   34084 "which domain is your current work in?"   a=Tech b=Non-tech c=Not Applicable   (working proxy)
--   34085 "current monthly salary or stipend…"      free text (₹, k, "no income", NA…)
--   34086 "willing to pause or leave your work…?"   a=Yes b=No c=Not sure d=Not Applicable
--   34075 "current course type?"                    a=Full-time b=Part-time c=Distance d=Online e=NA
--   34160 "how many people are there in your family?" integer (per-capita denominator + SES)
--   34168 "annual income of your family?"           free text (Indian format, "5,00,000")
-- SES rubric option answers (letter answers; see lib/ses.ts for score maps):
--   34016 gender (a=Female b=Male c=Transgender d=PNS) · 34025 place · 34158 marital
--   34159 social category · 34164 parent education · 34165 family situation · 34166 health
--   34170 house ownership · 34171 house condition · 34172 home location
--   34173 formal loans · 34174 informal loans · 34175 assets
--
-- BQ base tables have duplicate rows (upsert mirroring) — dedup via GROUP BY.

CREATE OR REPLACE VIEW `sensai-441917.sensai_prod.pulse_challenge_intake` AS
WITH
challenge_map AS (
  SELECT 214 AS cohort_id, 587 AS course_id   -- 14-Day Challenge (2026), HVA Screening 2026
),
hva_users AS (
  SELECT id, ANY_VALUE(LOWER(TRIM(email))) AS email
  FROM `sensai-441917.sensai_prod.users`
  WHERE created_at >= TIMESTAMP('2020-01-01')
  GROUP BY id
),
members AS (
  SELECT m.cohort_id, m.course_id, uc.user_id
  FROM challenge_map m
  JOIN `sensai-441917.sensai_prod.user_cohorts` uc
    ON uc.cohort_id = m.cohort_id
  WHERE uc.deleted_at IS NULL
    AND LOWER(uc.role) = 'learner'
  GROUP BY m.cohort_id, m.course_id, uc.user_id
),
-- Latest user answer per (user, question) among the intake questions.
latest AS (
  SELECT
    user_id, question_id, content,
    ROW_NUMBER() OVER (PARTITION BY user_id, question_id ORDER BY created_at DESC) AS rn
  FROM `sensai-441917.sensai_prod.chat_history`
  WHERE role = 'user'
    AND created_at >= TIMESTAMP('2024-01-01')
    AND question_id IN (
      34069, 34070, 34073, 34074, 34075, 34084, 34085, 34086, 34160, 34168,
      -- SES rubric questions:
      34016, 34025, 34158, 34159, 34164, 34165, 34166, 34170, 34171, 34172, 34173, 34174, 34175
    )
),
pivoted AS (
  SELECT
    user_id,
    MAX(IF(question_id = 34069, content, NULL)) AS studying_raw,
    MAX(IF(question_id = 34070, content, NULL)) AS level_raw,
    MAX(IF(question_id = 34073, content, NULL)) AS college_name,
    MAX(IF(question_id = 34074, content, NULL)) AS grad_year_raw,
    MAX(IF(question_id = 34075, content, NULL)) AS course_type_raw,
    MAX(IF(question_id = 34084, content, NULL)) AS work_domain_raw,
    MAX(IF(question_id = 34085, content, NULL)) AS salary_raw,
    MAX(IF(question_id = 34086, content, NULL)) AS willing_raw,
    MAX(IF(question_id = 34160, content, NULL)) AS family_size_raw,
    MAX(IF(question_id = 34168, content, NULL)) AS family_income_raw,
    MAX(IF(question_id = 34016, content, NULL)) AS gender_raw,
    MAX(IF(question_id = 34025, content, NULL)) AS place_raw,
    MAX(IF(question_id = 34158, content, NULL)) AS marital_raw,
    MAX(IF(question_id = 34159, content, NULL)) AS social_category_raw,
    MAX(IF(question_id = 34164, content, NULL)) AS parent_education_raw,
    MAX(IF(question_id = 34165, content, NULL)) AS family_situation_raw,
    MAX(IF(question_id = 34166, content, NULL)) AS health_raw,
    MAX(IF(question_id = 34170, content, NULL)) AS house_ownership_raw,
    MAX(IF(question_id = 34171, content, NULL)) AS house_condition_raw,
    MAX(IF(question_id = 34172, content, NULL)) AS home_location_raw,
    MAX(IF(question_id = 34173, content, NULL)) AS loan_formal_raw,
    MAX(IF(question_id = 34174, content, NULL)) AS loan_informal_raw,
    MAX(IF(question_id = 34175, content, NULL)) AS assets_raw
  FROM latest
  WHERE rn = 1
  GROUP BY user_id
)
SELECT
  m.cohort_id,
  m.course_id,
  u.email,
  p.studying_raw,
  p.level_raw,
  p.college_name,
  p.grad_year_raw,
  p.course_type_raw,
  p.work_domain_raw,
  p.salary_raw,
  p.willing_raw,
  p.family_size_raw,
  p.family_income_raw,
  p.gender_raw,
  p.place_raw,
  p.marital_raw,
  p.social_category_raw,
  p.parent_education_raw,
  p.family_situation_raw,
  p.health_raw,
  p.house_ownership_raw,
  p.house_condition_raw,
  p.home_location_raw,
  p.loan_formal_raw,
  p.loan_informal_raw,
  p.assets_raw
FROM members m
JOIN hva_users u ON u.id = m.user_id
LEFT JOIN pivoted p ON p.user_id = m.user_id
