-- 070: Challenge review — consistency (gap-days) gate + per-rule enable/disable.
--
-- max_gap_days: the consistency criterion passes when (span − active days) < this,
--   i.e. at most (N−1) idle days between first and last activity. Default 4 (≤3 gaps).
-- disabled_rules: criterion keys the team has switched OFF — a disabled rule does
--   NOT gate the system decision (shown but non-blocking).

ALTER TABLE public.challenge_review_config
  ADD COLUMN IF NOT EXISTS max_gap_days integer NOT NULL DEFAULT 4;

ALTER TABLE public.challenge_review_config
  ADD COLUMN IF NOT EXISTS disabled_rules text[] NOT NULL DEFAULT '{}';
