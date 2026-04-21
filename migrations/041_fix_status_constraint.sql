-- 041: Drop the old status check constraint (was never removed in 040)
ALTER TABLE interventions DROP CONSTRAINT IF EXISTS learning_interventions_status_check;
ALTER TABLE interventions DROP CONSTRAINT IF EXISTS interventions_status_check;
ALTER TABLE interventions ADD CONSTRAINT interventions_status_check
  CHECK (status IN ('open', 'in_progress', 'follow_up', 'closed'));
