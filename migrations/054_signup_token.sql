-- Migration 054: signup attribution token
--
-- Links a marketing-website form submission (learner_applications) to the Pulse
-- signup it produced (prospects), even when the learner signs in with a
-- different Google email than the one they typed on the form.
--
-- Flow: the form generates a UUID v4, stores it on its learner_applications row,
-- and shows a "Sign up to Pulse" button pointing at
--   https://pulse.academy.hyperverge.org/login?signup_token=<uuid>
-- The /login page forwards the token through the Supabase OAuth round-trip via
-- the redirectTo query string; the auth callback persists it on the prospect it
-- creates and stamps signed_up_at back on the form row.

-- Token stored on the Pulse signup (prospect) created from a tokened link.
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS signup_token text;

-- Partial index: the vast majority of prospects have no token.
CREATE INDEX IF NOT EXISTS prospects_signup_token_idx
  ON public.prospects (signup_token)
  WHERE signup_token IS NOT NULL;

-- signup_token is written by the form side on insert.
-- signed_up_at is stamped by Pulse's auth callback when a tokened signup
-- completes (keep-first; never overwritten once set).
ALTER TABLE public.learner_applications
  ADD COLUMN IF NOT EXISTS signup_token text,
  ADD COLUMN IF NOT EXISTS signed_up_at  timestamp with time zone;

-- Not UNIQUE on purpose: a forwarded link could produce two prospects sharing
-- one token. Keep-first semantics are enforced in the auth callback, not here.
CREATE INDEX IF NOT EXISTS learner_applications_signup_token_idx
  ON public.learner_applications (signup_token)
  WHERE signup_token IS NOT NULL;
