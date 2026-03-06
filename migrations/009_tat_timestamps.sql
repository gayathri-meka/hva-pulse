-- TAT (Turnaround Time) timestamp columns
-- These are set automatically by the server action when status transitions occur:
--   shortlisting_decision_taken_at → set when status changes to 'shortlisted' or 'not_shortlisted'
--   interviews_started_at          → set when status changes to 'interviews_ongoing'
--   hiring_decision_taken_at       → set when status changes to 'hired' or 'rejected'

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS shortlisting_decision_taken_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interviews_started_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hiring_decision_taken_at       TIMESTAMPTZ;
