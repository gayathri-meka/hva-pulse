-- 040: Rename monitoring → follow_up, resurface_date → decision_date, reviews → update_log

-- 1. Rename columns
ALTER TABLE interventions RENAME COLUMN resurface_date TO decision_date;
ALTER TABLE interventions RENAME COLUMN reviews        TO update_log;

-- 2. Migrate status values before changing the constraint
UPDATE interventions SET status = 'follow_up' WHERE status = 'monitoring';

-- 3. Rebuild status CHECK constraint (original name from when table was learning_interventions)
ALTER TABLE interventions DROP CONSTRAINT IF EXISTS learning_interventions_status_check;
ALTER TABLE interventions DROP CONSTRAINT IF EXISTS interventions_status_check;
ALTER TABLE interventions ADD CONSTRAINT interventions_status_check
  CHECK (status IN ('open', 'in_progress', 'follow_up', 'closed'));

-- 4. Backfill decision_date for existing active interventions that have none
UPDATE interventions
   SET decision_date = (created_at::date + interval '14 days')::date
 WHERE decision_date IS NULL AND status != 'closed';

-- 5. Rename new_resurface_date → decision_date_pushed_to in existing JSONB log entries
UPDATE interventions
   SET update_log = (
     SELECT jsonb_agg(
       CASE
         WHEN entry ? 'new_resurface_date' THEN
           (entry - 'new_resurface_date')
           || jsonb_build_object('decision_date_pushed_to', entry -> 'new_resurface_date')
         ELSE entry
       END
     )
     FROM jsonb_array_elements(COALESCE(update_log, '[]'::jsonb)) AS entry
   )
 WHERE jsonb_array_length(COALESCE(update_log, '[]'::jsonb)) > 0;
