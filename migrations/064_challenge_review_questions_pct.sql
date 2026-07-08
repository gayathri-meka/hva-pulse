-- 064: Switch the engagement gate from an absolute attempted-questions count to a
-- PERCENTAGE of the challenge's questions attempted (the challenge grew to ~263
-- questions, so an absolute "> 100" is no longer meaningful).
--
-- min_attempted_questions is left in place (unused) to avoid a destructive drop.

ALTER TABLE public.challenge_review_config
  ADD COLUMN IF NOT EXISTS min_questions_attempted_pct integer NOT NULL DEFAULT 40;
