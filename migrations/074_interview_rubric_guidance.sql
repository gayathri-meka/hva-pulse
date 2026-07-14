-- 074: Add interviewer-guidance fields to rubrics.
--   looking_for  — one line: the signal the interviewer is assessing (superseded by
--                  per-score looking_for_1..4 in migration 075)
--   example_1..4 — calibration examples per score level (newline-separated)

ALTER TABLE public.interview_rubrics
  ADD COLUMN IF NOT EXISTS looking_for text,
  ADD COLUMN IF NOT EXISTS example_1 text,
  ADD COLUMN IF NOT EXISTS example_2 text,
  ADD COLUMN IF NOT EXISTS example_3 text,
  ADD COLUMN IF NOT EXISTS example_4 text;

UPDATE public.interview_rubrics SET looking_for = 'Real financial pressure and lack of alternatives — genuine necessity vs convenience.'
  WHERE key = 'need' AND looking_for IS NULL;
UPDATE public.interview_rubrics SET looking_for = 'Self-initiated ownership and follow-through — did they step up without being told?'
  WHERE key = 'drive' AND looking_for IS NULL;
UPDATE public.interview_rubrics SET looking_for = 'Realistic expectations, genuine tech commitment, and no conflicting parallel plans.'
  WHERE key = 'program_alignment' AND looking_for IS NULL;
UPDATE public.interview_rubrics SET looking_for = 'A schedule that can sustain the daily effort — blockers, exams, travel, honesty about constraints.'
  WHERE key = 'time_commitment' AND looking_for IS NULL;
UPDATE public.interview_rubrics SET looking_for = 'Clarity of spoken communication — grammar and pronunciation.'
  WHERE key = 'articulation' AND looking_for IS NULL;
UPDATE public.interview_rubrics SET looking_for = 'Whether they understand what is actually being asked and answer it.'
  WHERE key = 'comprehension' AND looking_for IS NULL;
