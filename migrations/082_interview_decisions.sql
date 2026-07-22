-- 082: Interview pipeline decisions — the team's release gates after each round.
--
-- After Round 1 (Motivation) the team RELEASES a decision: 'advance' unlocks the
-- Round 2 (Coding) booking for the candidate; 'rejected' ends it. After Round 2
-- the team makes the FINAL call: 'selected' or 'rejected'. Recording a value here
-- IS the release (single step). Candidate booking is gated on these (getBookingState).

CREATE TABLE IF NOT EXISTS public.interview_decisions (
  candidate_email    text PRIMARY KEY,                                   -- normalised
  stage1             text CHECK (stage1 IN ('advance', 'rejected')),     -- post Round 1
  stage1_reason      text,
  stage1_released_at timestamptz,
  final              text CHECK (final IN ('selected', 'rejected')),     -- post Round 2
  final_reason       text,
  final_released_at  timestamptz,
  decided_by         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Staff/admin manage; candidate reads go via the service-role client filtered to
-- their own email (the established pattern — candidates aren't in the users table).
ALTER TABLE public.interview_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_all ON public.interview_decisions;
CREATE POLICY staff_all ON public.interview_decisions
  USING (public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text]));
