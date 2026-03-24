-- ============================================================
-- Migration 021: Add is_current_cohort and sub_cohort to learners
-- Run in Supabase SQL Editor
-- ============================================================

-- is_current_cohort: true = part of the active programme shown on dashboard
-- false = historical learner data (not yet added, but planned)
ALTER TABLE public.learners
  ADD COLUMN IF NOT EXISTS is_current_cohort boolean NOT NULL DEFAULT false;

-- Back-fill all existing rows as current cohort
UPDATE public.learners SET is_current_cohort = true;

-- sub_cohort: intake phase within a cohort (e.g. 'Jul', 'Oct', 'BA')
ALTER TABLE public.learners
  ADD COLUMN IF NOT EXISTS sub_cohort text;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_learners_is_current_cohort
  ON public.learners(is_current_cohort);

CREATE INDEX IF NOT EXISTS idx_learners_sub_cohort
  ON public.learners(sub_cohort);
