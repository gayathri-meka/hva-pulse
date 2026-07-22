-- 080: Allow 'review' as a valid system_decision_at_verify snapshot.
--
-- When the team records a manual decision (Select/Reject) on a candidate whose
-- SYSTEM verdict is 'review', we snapshot system_decision_at_verify = 'review'.
-- The original constraint only permitted 'selected'/'rejected', so those saves
-- failed with:
--   new row ... violates check constraint "challenge_decisions_system_decision_at_verify_check"
--
-- Add 'review' to the allowed set. Deliberately DO NOT allow 'in_progress' —
-- learners still mid-challenge must not be selected/rejected yet (setChallengeDecision
-- also blocks that path with a friendly error).

ALTER TABLE public.challenge_decisions
  DROP CONSTRAINT IF EXISTS challenge_decisions_system_decision_at_verify_check;

ALTER TABLE public.challenge_decisions
  ADD CONSTRAINT challenge_decisions_system_decision_at_verify_check
  CHECK (system_decision_at_verify IN ('selected', 'rejected', 'review'));
