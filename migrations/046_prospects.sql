-- 046: Prospects table. Captures every Google sign-in whose email is not in
-- `users` so admins can see who is interested and promote them later (to
-- learner, mentor, staff, admin, etc.). Written to from /auth/callback via
-- the service-role client; read by /admissions/prospects.

CREATE TABLE IF NOT EXISTS public.prospects (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  email         text        NOT NULL UNIQUE,
  name          text,
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prospects_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS prospects_created_at_idx ON public.prospects (created_at DESC);

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_all ON public.prospects;
CREATE POLICY staff_all ON public.prospects
  FOR ALL USING (auth_role() IN ('admin', 'staff'));
