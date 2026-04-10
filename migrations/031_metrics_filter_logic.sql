-- Allow choosing AND vs OR for metric filter combination.
-- Default 'and' preserves existing behavior.
ALTER TABLE public.metrics
  ADD COLUMN IF NOT EXISTS filter_logic text NOT NULL DEFAULT 'and'
    CHECK (filter_logic IN ('and', 'or'));
