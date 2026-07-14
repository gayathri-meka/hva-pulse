-- 075: "What we're looking for" moves from one line per rubric to one per score.
-- Adds looking_for_1..4 (per score) and drops the single per-rubric looking_for
-- added in 074. Examples (example_1..4) stay as-is.

ALTER TABLE public.interview_rubrics
  ADD COLUMN IF NOT EXISTS looking_for_1 text,
  ADD COLUMN IF NOT EXISTS looking_for_2 text,
  ADD COLUMN IF NOT EXISTS looking_for_3 text,
  ADD COLUMN IF NOT EXISTS looking_for_4 text;

-- The old single per-rubric line is superseded by the per-score fields above.
ALTER TABLE public.interview_rubrics DROP COLUMN IF EXISTS looking_for;
