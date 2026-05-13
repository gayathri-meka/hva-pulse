-- 043: Categorise intervention root causes as Time / Learning / Both.
-- Set when an admin fills the Step 2 ("Why?") form alongside the existing
-- root_cause_categories checklist. Legacy rows (filled before this column
-- existed) stay NULL and are displayed as "Filled" in the UI until edited.

ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS root_cause_type text
    CHECK (root_cause_type IN ('time', 'learning', 'both', 'other'));
