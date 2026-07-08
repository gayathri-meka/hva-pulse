-- 065: Editable income cap for the work-commitment gate.
--
-- A working candidate earning MORE than this per year is rejected regardless of
-- willingness to quit. Default 6 LPA (600000). Editable in Review → Edit rules.

ALTER TABLE public.challenge_review_config
  ADD COLUMN IF NOT EXISTS max_work_income_annual integer NOT NULL DEFAULT 600000;
