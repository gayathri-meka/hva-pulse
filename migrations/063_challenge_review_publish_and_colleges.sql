-- 063: Challenge review — publish step, excluded colleges, and (re-)add per-capita.
--
-- All IF NOT EXISTS so this is safe to apply even if migration 060 was already run.
-- (060 added max_per_capita_income_annual but was missed on this DB — see #3.)

-- #1 Publish step: a decision is recorded internally when selected/rejected, but is
-- only visible on the candidate portal once released. NULL = internal only.
ALTER TABLE public.challenge_decisions
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- #3 Per-capita income threshold (also in 060; repeated idempotently).
ALTER TABLE public.challenge_review_config
  ADD COLUMN IF NOT EXISTS max_per_capita_income_annual integer;

-- #2 Colleges we won't take learners from (strong-placement colleges). Editable in
-- the Review → Edit rules section. A candidate whose college matches one of these is
-- eliminated. Empty list = the college gate is inactive (criterion stays 'na').
ALTER TABLE public.challenge_review_config
  ADD COLUMN IF NOT EXISTS excluded_colleges text[] NOT NULL DEFAULT '{}';
