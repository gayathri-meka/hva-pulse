-- ============================================================
-- Migration 002: Learner Placements Surface
-- Run in Supabase SQL Editor
-- ============================================================
BEGIN;

-- 1. Add user_id to applications (needed for clean learner RLS)
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);

-- 2. Backfill user_id from learners table for existing rows
UPDATE public.applications a
SET user_id = l.user_id
FROM public.learners l
WHERE a.learner_id = l.learner_id
  AND a.user_id IS NULL;

-- 3. Create resumes table
CREATE TABLE IF NOT EXISTS public.resumes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_url     text        NOT NULL,
  version_name text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON public.resumes(user_id);

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

-- 4. Create role_preferences table (for "Not Interested" signal)
CREATE TABLE IF NOT EXISTS public.role_preferences (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id    uuid        NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  preference text        NOT NULL CHECK (preference IN ('not_interested')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_role_preferences_user_id ON public.role_preferences(user_id);

ALTER TABLE public.role_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Applications: learner can read/create/update their own
CREATE POLICY "learner_read_own_applications" ON public.applications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "learner_insert_own_applications" ON public.applications
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "learner_update_own_applications" ON public.applications
  FOR UPDATE USING (user_id = auth.uid());

-- Companies: any authenticated user can read
CREATE POLICY "authenticated_read_companies" ON public.companies
  FOR SELECT USING (auth.role() = 'authenticated');

-- Roles: any authenticated user can read
CREATE POLICY "authenticated_read_roles" ON public.roles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Resumes: learner manages only their own
CREATE POLICY "learner_all_own_resumes" ON public.resumes
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Role preferences: learner manages only their own
CREATE POLICY "learner_all_own_role_preferences" ON public.role_preferences
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- STORAGE — resumes bucket
-- Public bucket (URLs work directly; paths include user_id so
-- they are not guessable)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Learners can upload own resumes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Learners can delete own resumes"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Anyone can read resumes"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'resumes');

COMMIT;

-- ============================================================
-- NOTE: Resume file uploads are limited by Next.js server
-- action body size (default 1 MB). If needed, add to
-- next.config.js:
--   experimental: { serverActions: { bodySizeLimit: '5mb' } }
-- ============================================================
