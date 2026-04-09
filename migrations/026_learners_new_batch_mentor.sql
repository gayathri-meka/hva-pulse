-- Add new_batch and new_mentor columns to learners
-- (new_lf already exists). These three are sourced from the Learner Roster sheet
-- columns "New LF", "New Batch", "New Mentor".

ALTER TABLE public.learners
  ADD COLUMN IF NOT EXISTS new_batch  text,
  ADD COLUMN IF NOT EXISTS new_mentor text;
