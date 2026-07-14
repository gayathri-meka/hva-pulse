-- 078: Bucket/section tag on interview questions (General / Drive / Need /
-- Time & Commitment / Program Alignment). Shown as a chip in the cockpit and
-- editable in the config editor. Nullable — ungrouped questions just have none.

ALTER TABLE public.interview_questions
  ADD COLUMN IF NOT EXISTS section text;
