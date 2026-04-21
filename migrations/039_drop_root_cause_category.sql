-- Drop the old single-value root_cause_category column now that
-- root_cause_categories (JSONB array) from migration 038 replaces it.
ALTER TABLE interventions
  DROP COLUMN IF EXISTS root_cause_category;
