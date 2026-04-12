-- Rename the 'LF' role to 'staff' across the system.
-- LF-specific column names (lf_name, lf_user_id) stay unchanged —
-- they describe the real-world Learning Facilitator person, not the app role.

-- 1. Update existing rows
UPDATE public.users SET role = 'staff' WHERE role = 'LF';

-- 2. Replace the CHECK constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'staff', 'learner'));

-- 3. Update RLS policies that reference 'LF'
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email'
$$;

-- Drop and recreate staff policies (old ones reference 'LF')
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'users','learners','applications','companies','roles','role_preferences',
      'resumes','alumni','alumni_jobs','job_personas','job_opportunities',
      'sync_logs','settings','interventions','metrics','metric_sources',
      'metric_source_columns','metric_raw_rows'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS staff_all ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY staff_all ON public.%I FOR ALL USING (auth_role() IN (''admin'', ''staff''))',
      tbl
    );
  END LOOP;
END;
$$;
