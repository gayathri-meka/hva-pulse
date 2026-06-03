-- 050: Capture interest-form responses on the prospects row.
-- The interest form at /candidate/interest-form collects phone, college, and
-- education status. We persist them directly on the prospect, and stamp
-- `interest_form_submitted_at` so the admins/admissions tab can filter on
-- submitted vs pending. `education_status` is a single text column — when
-- the user picks "Other" and types a free-text answer, that free-text is
-- what gets stored (no separate Other column).

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS phone                       text,
  ADD COLUMN IF NOT EXISTS college                     text,
  ADD COLUMN IF NOT EXISTS education_status            text,
  ADD COLUMN IF NOT EXISTS interest_form_submitted_at  timestamptz;

CREATE INDEX IF NOT EXISTS prospects_submitted_idx
  ON public.prospects (interest_form_submitted_at DESC NULLS LAST);
