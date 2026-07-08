-- 067: SensAI grading evals — human labels on the AI grader's output.
--
-- The team reviews, per (learner, question), the score + feedback the AI grader
-- produced against a scorecard (see the by-question conversation view) and tags
-- whether it's right/wrong, with observed SYMPTOMS (not root cause). Powers grader
-- accuracy + failure-mode reporting. Program-agnostic: `context` scopes a batch
-- (e.g. 'screening'); the same table serves other programs later.
--
-- Single-rater, latest-attempt: one label per (context, question_id, learner_email),
-- upserted. A snapshot of the judged AI output + scorecard is captured at tag time
-- so the label stays meaningful even if the grader re-runs or the scorecard changes.

CREATE TABLE IF NOT EXISTS public.sensai_grading_evals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context            text NOT NULL,                       -- program/batch scope, e.g. 'screening'
  question_id        text NOT NULL,                       -- sensai question id
  learner_email      text NOT NULL,
  verdict            text NOT NULL CHECK (verdict IN ('correct', 'incorrect')),
  symptoms           text[] NOT NULL DEFAULT '{}',        -- observed issues (only when incorrect)
  comment            text,
  -- snapshot of what was judged (the live AI output can change later)
  ai_score           text,
  ai_feedback        text,
  scorecard_snapshot text,
  labeled_by         text NOT NULL,
  labeled_by_name    text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (context, question_id, learner_email)
);

CREATE INDEX IF NOT EXISTS idx_grading_evals_context_question
  ON public.sensai_grading_evals (context, question_id);
CREATE INDEX IF NOT EXISTS idx_grading_evals_learner
  ON public.sensai_grading_evals (learner_email);
