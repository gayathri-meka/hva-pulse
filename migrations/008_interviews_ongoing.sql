-- Add 'interviews_ongoing' as a valid application status.
-- This status sits between 'shortlisted' (awaiting interview) and 'hired'/'rejected'.
-- Status progression:
--   applied → shortlisted → interviews_ongoing → hired
--                                              ↘ rejected
--   (on_hold = company paused hiring, orthogonal to the above flow)

-- If a check constraint exists on applications.status, update it:
ALTER TABLE applications
  DROP CONSTRAINT IF EXISTS applications_status_check;

ALTER TABLE applications
  ADD CONSTRAINT applications_status_check
  CHECK (status IN (
    'applied', 'shortlisted', 'interviews_ongoing', 'on_hold',
    'not_shortlisted', 'rejected', 'hired'
  ));
