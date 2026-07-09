-- 068: Tag grading evals per ATTEMPT, not just the latest per (learner, question).
--
-- Adds attempt_at (the grader response's timestamp, as the ISO string shown in the
-- UI) to the key so each response/feedback can be labeled independently. Existing
-- rows keep attempt_at = '' (they were the pre-change "latest/unspecified" label).

ALTER TABLE public.sensai_grading_evals
  ADD COLUMN IF NOT EXISTS attempt_at text NOT NULL DEFAULT '';

ALTER TABLE public.sensai_grading_evals
  DROP CONSTRAINT IF EXISTS sensai_grading_evals_context_question_id_learner_email_key;

ALTER TABLE public.sensai_grading_evals
  ADD CONSTRAINT sensai_grading_evals_uniq
  UNIQUE (context, question_id, learner_email, attempt_at);
