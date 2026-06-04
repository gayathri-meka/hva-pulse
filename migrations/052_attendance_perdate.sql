-- 052: Fix attendance_records so per-date attendance survives sync.
-- The old constraint (meeting_code, participant_email) collapsed daily
-- attendance for recurring calls into a single row per learner. The new
-- constraint scopes uniqueness to the actual session (call, person, date),
-- so a learner who attended JS Call 40 times gets 40 rows.
--
-- After this migration is applied, run /api/sync-attendance once to backfill
-- the per-date rows that were lost.

BEGIN;

ALTER TABLE public.attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_meet_email_unique;

ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_meet_email_date_unique
    UNIQUE (meeting_code, participant_email, call_date);

COMMIT;
