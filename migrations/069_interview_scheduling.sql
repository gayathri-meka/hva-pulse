-- 069: Interview scheduling — Phase A (the scheduling machine).
--
-- Selected+released challenge candidates book interviews from a pool of slots that
-- interviewers publish. Two SEQUENTIAL rounds per candidate (round 2 unlocks after
-- round 1 completes). Booking into an interviewer's own published slot auto-confirms.
-- Identity is the normalised email throughout (matches prospects / challenge_decisions).
--
-- Adds an 'interviewer' role: interviewers are Pulse users who log in via Google and
-- get a scoped /interviewer portal (redirected in the (protected) layout, like learner).

-- 1. Role: add 'interviewer' to the users constraint (pattern of migration 035).
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'staff', 'guest', 'learner', 'interviewer'));

-- 2. Slots — availability an interviewer publishes into the shared pool.
CREATE TABLE IF NOT EXISTS public.interview_slots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interviewer_email text NOT NULL,                 -- normalised; a users row with role 'interviewer'
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz NOT NULL,
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'booked', 'blocked')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_interview_slots_interviewer ON public.interview_slots (interviewer_email);
CREATE INDEX IF NOT EXISTS idx_interview_slots_open ON public.interview_slots (status, starts_at);

-- 3. Interviews — the booking. One active interview per (candidate, round).
CREATE TABLE IF NOT EXISTS public.interviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_email   text NOT NULL,                 -- normalised (matches challenge_decisions)
  round             smallint NOT NULL CHECK (round IN (1, 2)),
  slot_id           uuid REFERENCES public.interview_slots(id) ON DELETE SET NULL,
  interviewer_email text NOT NULL,
  scheduled_at      timestamptz NOT NULL,
  status            text NOT NULL DEFAULT 'confirmed'
                      CHECK (status IN ('booked', 'confirmed', 'completed', 'no_show', 'cancelled')),
  meet_link         text,
  calendar_event_id text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON public.interviews (candidate_email);
CREATE INDEX IF NOT EXISTS idx_interviews_interviewer ON public.interviews (interviewer_email);
-- At most one non-cancelled interview per candidate per round.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_interview_active
  ON public.interviews (candidate_email, round)
  WHERE status <> 'cancelled';

-- 4. RLS — admin/staff manage everything; candidate + interviewer reads go through
-- the service-role client filtered to their authed email (the established pattern for
-- candidate-owned data, since candidates aren't in the users table).
ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_all ON public.interview_slots;
CREATE POLICY staff_all ON public.interview_slots
  USING (public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text]));

DROP POLICY IF EXISTS staff_all ON public.interviews;
CREATE POLICY staff_all ON public.interviews
  USING (public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text]));
