-- Composite metrics: combine multiple existing metrics with weights
-- A composite metric collapses each time-series input to a scalar (LAST/AVG/SUM)
-- and produces a single weighted-sum value per learner.

ALTER TABLE public.metrics
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'simple'
    CHECK (kind IN ('simple', 'composite')),
  ADD COLUMN IF NOT EXISTS composite_inputs jsonb NOT NULL DEFAULT '[]';

-- Simple-metric fields are required only when kind = 'simple'
ALTER TABLE public.metrics ALTER COLUMN source_id   DROP NOT NULL;
ALTER TABLE public.metrics ALTER COLUMN aggregation DROP NOT NULL;

-- Enforce: simple metrics must have a source + aggregation;
-- composite metrics must have at least one input
ALTER TABLE public.metrics
  ADD CONSTRAINT metrics_kind_fields_chk CHECK (
    (kind = 'simple'    AND source_id IS NOT NULL AND aggregation IS NOT NULL)
    OR
    (kind = 'composite' AND jsonb_array_length(composite_inputs) > 0)
  );
