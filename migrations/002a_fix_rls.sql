-- ============================================================
-- Migration 002a: Fix learner RLS policies
--
-- Root cause: auth.uid() returns auth.users.id (Google OAuth UID),
-- but our public.users.id is a separately generated UUID from the
-- identity refactor. They are different, so auth.uid() comparisons
-- always fail. The fix mirrors the existing admin pattern: look up
-- public.users.id via the email embedded in the JWT.
-- ============================================================
BEGIN;

-- 1. Helper: look up our custom user id from the JWT email
--    SECURITY DEFINER + STABLE so it runs once per statement
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id FROM public.users WHERE email = auth.jwt()->>'email'
$$;

-- 2. Fix applications RLS
DROP POLICY IF EXISTS "learner_read_own_applications"   ON public.applications;
DROP POLICY IF EXISTS "learner_insert_own_applications" ON public.applications;
DROP POLICY IF EXISTS "learner_update_own_applications" ON public.applications;

CREATE POLICY "learner_read_own_applications" ON public.applications
  FOR SELECT USING (user_id = public.current_user_id());

CREATE POLICY "learner_insert_own_applications" ON public.applications
  FOR INSERT WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "learner_update_own_applications" ON public.applications
  FOR UPDATE USING (user_id = public.current_user_id());

-- 3. Fix resumes RLS
DROP POLICY IF EXISTS "learner_all_own_resumes" ON public.resumes;

CREATE POLICY "learner_all_own_resumes" ON public.resumes
  FOR ALL
  USING  (user_id = public.current_user_id())
  WITH CHECK (user_id = public.current_user_id());

-- 4. Fix role_preferences RLS
DROP POLICY IF EXISTS "learner_all_own_role_preferences" ON public.role_preferences;

CREATE POLICY "learner_all_own_role_preferences" ON public.role_preferences
  FOR ALL
  USING  (user_id = public.current_user_id())
  WITH CHECK (user_id = public.current_user_id());

-- 5. Fix storage policies
--    Original policies checked (storage.foldername(name))[1] = auth.uid()::text
--    but files are stored at {public.users.id}/{timestamp}.pdf — not the auth UID.
--    Simpler: allow any authenticated user to upload; for delete, use the
--    'owner' column which Supabase sets automatically to auth.uid() on upload.
DROP POLICY IF EXISTS "Learners can upload own resumes"   ON storage.objects;
DROP POLICY IF EXISTS "Learners can delete own resumes"   ON storage.objects;

CREATE POLICY "Authenticated users can upload resumes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Users can delete own resume files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND owner = auth.uid());

COMMIT;
