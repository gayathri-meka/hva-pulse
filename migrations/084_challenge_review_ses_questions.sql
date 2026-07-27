-- Admin-configurable SES question labels/order and appended 0–4 questions.
ALTER TABLE public.challenge_review_config
  ADD COLUMN IF NOT EXISTS ses_questions jsonb;

COMMENT ON COLUMN public.challenge_review_config.ses_questions IS
  'Ordered SES question definitions [{key,label,optionLabels}]. Existing keys retain their intake mapping; new keys read <key>_raw.';
