-- Change root cause from single text to multi-select array
ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS root_cause_categories JSONB NOT NULL DEFAULT '[]';
