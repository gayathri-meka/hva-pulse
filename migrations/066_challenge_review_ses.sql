-- 066: Editable SES weights + cutoff for the challenge review Need gate.
--
-- The SES rubric (questions + per-option 0–4 scores) is fixed in code (lib/ses.ts).
-- Only the per-question WEIGHTS and the pass CUTOFF are editable, via the Edit-rules
-- SES tab. ses_weights is a { questionKey: weight } override map ({} = use defaults).
-- ses_cutoff NULL = not configured → the SES criterion stays 'na'.

ALTER TABLE public.challenge_review_config
  ADD COLUMN IF NOT EXISTS ses_weights jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.challenge_review_config
  ADD COLUMN IF NOT EXISTS ses_cutoff integer;
