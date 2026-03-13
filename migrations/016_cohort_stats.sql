-- Stores manually-entered cohort-level stats (onboarded, dropouts)
-- "placed" is always computed live from the alumni table

CREATE TABLE IF NOT EXISTS public.cohort_stats (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  cohort_fy  text        NOT NULL UNIQUE,
  onboarded  integer     NOT NULL DEFAULT 0,
  dropouts   integer     NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
