-- Redesign interventions: new step 1 (what's wrong), step 2 (why), step 3 (what next)
ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS flagged_items    JSONB       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS what_wrong_notes TEXT,
  ADD COLUMN IF NOT EXISTS step3_completed_at TIMESTAMPTZ;

-- Discard all existing data (clean slate for new flow)
DELETE FROM interventions;
