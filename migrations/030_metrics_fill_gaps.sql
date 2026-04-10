-- Opt-in flag for zero-filling weekly gaps in time-series metrics.
-- Default true (fill gaps). Set false to show only weeks with actual data.
ALTER TABLE public.metrics
  ADD COLUMN IF NOT EXISTS fill_gaps boolean NOT NULL DEFAULT true;
