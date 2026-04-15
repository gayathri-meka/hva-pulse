-- Add 'guest' role: read-only access to all data, PII masked at app level.

-- 1. Update role constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'staff', 'guest', 'learner'));

-- 2. RLS: guest gets SELECT on all tables (same as staff read access)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'users','learners','applications','companies','roles','role_preferences',
      'resumes','alumni','alumni_jobs','job_personas','job_opportunities',
      'sync_logs','settings','interventions','metrics','metric_sources',
      'metric_source_columns','metric_raw_rows','learner_analysis'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS guest_read ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY guest_read ON public.%I FOR SELECT USING (auth_role() = ''guest'')',
      tbl
    );
  END LOOP;
END;
$$;

-- Also update the staff_all policies to include guest for SELECT
-- (staff_all is FOR ALL which covers SELECT too, but guest needs explicit SELECT-only)
-- The guest_read policy above handles this — no changes to staff_all needed.
