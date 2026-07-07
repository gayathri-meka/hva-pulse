-- 060: Editable per-capita income threshold for the challenge review Need gate.
--
-- Per-capita family income = annual family income ÷ total family size (the only
-- computable definition — the challenge doesn't ask for earning-member count).
-- Below this annual figure = financial need established (pass); at/above = fail.
--
-- Nullable on purpose: until an admin sets a value in the Edit-rules modal, the
-- per_capita_income criterion stays 'na' (non-gating) rather than guessing a cutoff.

ALTER TABLE public.challenge_review_config
  ADD COLUMN IF NOT EXISTS max_per_capita_income_annual integer;
