-- 081: Interviewer specialisation.
--
-- Each interviewer runs exactly ONE round — Motivation (1) or Coding (2) — a
-- separate panel per round. An interviewer's published availability slots inherit
-- their round, so a candidate only ever books the correct panel for the round
-- they're on. This closes the gap where round-agnostic slots let a Coding round
-- be booked against a Motivation interviewer.

-- Specialisation on the interviewer (a users row; admin/staff who also interview
-- can be given one too). NULL = not set yet.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS interview_round smallint CHECK (interview_round IN (1, 2));

-- Round the slot serves — copied from the painter's specialisation at publish time.
ALTER TABLE public.interview_slots
  ADD COLUMN IF NOT EXISTS round smallint CHECK (round IN (1, 2));

-- Backfill: today's entire panel is Motivation (round 1).
UPDATE public.users
  SET interview_round = 1
  WHERE role = 'interviewer' AND interview_round IS NULL;
UPDATE public.interview_slots
  SET round = 1
  WHERE round IS NULL;

-- Booking reads open slots by (round, status, start).
CREATE INDEX IF NOT EXISTS idx_interview_slots_round_open
  ON public.interview_slots (round, status, starts_at);
