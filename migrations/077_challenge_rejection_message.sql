-- 077: Candidate-facing rejection message for challenge decisions.
--   rejection_reason_type — which reason category the team picked (a criterion key
--                           or 'general'); used to default the message + for analytics
--   rejection_message     — the (editable) message shown to the candidate on reject

ALTER TABLE public.challenge_decisions
  ADD COLUMN IF NOT EXISTS rejection_reason_type text,
  ADD COLUMN IF NOT EXISTS rejection_message text;
