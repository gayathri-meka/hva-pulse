-- Add reviews log to interventions
-- Each review is an event: { at, by, by_name, note, new_resurface_date }

ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS reviews jsonb NOT NULL DEFAULT '[]';
