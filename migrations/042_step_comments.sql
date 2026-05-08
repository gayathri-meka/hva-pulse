-- Add comment threads to Step 1 ("What's wrong?") and Step 2 ("Why?") of interventions.
-- Step 3's per-action-item comments live inside the existing action_items JSONB.

ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS what_wrong_comments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS why_comments        JSONB NOT NULL DEFAULT '[]'::jsonb;
