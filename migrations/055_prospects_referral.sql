-- Migration 055: referral fields on prospects
--
-- The interest form now mirrors the marketing apply form's "How did you hear
-- about us?" question. These columns store the prospect's answer (and the
-- per-source detail, e.g. an NGO name, referrer name, or social platform).
-- Mirrors referral_source / referral_detail on learner_applications.

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS referral_detail text;
