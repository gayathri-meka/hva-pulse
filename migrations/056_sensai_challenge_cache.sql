-- Migration 056: cache for SensAI 14-Day Challenge progress
--
-- Pulse fetches a learner's challenge progress live from SensAI's own DB
-- (read-only, via SENSAI_DATABASE_URL — see lib/sensai.ts) and caches the
-- snapshot here (~10 min TTL) so the challenge page stays fast and we don't
-- hammer SensAI on every view.
--
-- NOT YET WIRED into the page — apply this only when we reintroduce the live
-- progress display. Read/written exclusively by the service-role client, so
-- RLS is on with no policies (service role bypasses it; nothing else can read).

CREATE TABLE IF NOT EXISTS public.sensai_challenge_progress (
  email      text PRIMARY KEY,
  data       jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sensai_challenge_progress ENABLE ROW LEVEL SECURITY;
