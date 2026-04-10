-- ============================================================
-- Row Level Security for all Pulse tables
-- ============================================================
--
-- Threat model: a learner who grabs the anon key from their browser
-- and queries Supabase directly, bypassing the app's role checks.
--
-- Policy design:
--   - Admins and LFs: full read/write on all tables (staff)
--   - Learners: can only see/modify their own data
--   - Unauthenticated: blocked entirely (no anon access)
--
-- The service_role key (used for storage uploads, sync routes)
-- bypasses RLS automatically — no policy needed for those flows.
--
-- Helper: looks up the calling user's role from the users table.
-- Cached per-transaction by Postgres, so multiple policy checks
-- in one request only run the subquery once.

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

-- ── Enable RLS on every table ────────────────────────────────────────────────

ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learners               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_preferences       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni_jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_personas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_opportunities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_sources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_source_columns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_raw_rows        ENABLE ROW LEVEL SECURITY;

-- Also enable on cohort_stats if it exists (created in migration 013)
ALTER TABLE IF EXISTS public.cohort_stats ENABLE ROW LEVEL SECURITY;

-- ── Staff policies (admin + LF): full access ─────────────────────────────────
-- One policy per table. Staff can do everything.

CREATE POLICY staff_all ON public.users                 FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.learners              FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.applications          FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.companies             FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.roles                 FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.role_preferences      FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.resumes               FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.alumni                FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.alumni_jobs           FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.job_personas          FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.job_opportunities     FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.sync_logs             FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.settings              FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.interventions         FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.metrics               FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.metric_sources        FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.metric_source_columns FOR ALL USING (auth_role() IN ('admin', 'LF'));
CREATE POLICY staff_all ON public.metric_raw_rows       FOR ALL USING (auth_role() IN ('admin', 'LF'));

-- ── Learner policies: own data only ──────────────────────────────────────────

-- users: learners can read their own row
CREATE POLICY learner_own ON public.users
  FOR SELECT USING (auth_role() = 'learner' AND id = auth.uid());

-- learners: read own learner record (joined via user_id)
CREATE POLICY learner_own ON public.learners
  FOR SELECT USING (auth_role() = 'learner' AND user_id = auth.uid());

-- applications: read + insert own applications
CREATE POLICY learner_read_own ON public.applications
  FOR SELECT USING (auth_role() = 'learner' AND user_id = auth.uid());
CREATE POLICY learner_insert_own ON public.applications
  FOR INSERT WITH CHECK (auth_role() = 'learner' AND user_id = auth.uid());

-- role_preferences: read + upsert own preferences
CREATE POLICY learner_read_own ON public.role_preferences
  FOR SELECT USING (auth_role() = 'learner' AND user_id = auth.uid());
CREATE POLICY learner_write_own ON public.role_preferences
  FOR ALL USING (auth_role() = 'learner' AND user_id = auth.uid());

-- resumes: read + insert own resumes
CREATE POLICY learner_read_own ON public.resumes
  FOR SELECT USING (auth_role() = 'learner' AND user_id = auth.uid());
CREATE POLICY learner_write_own ON public.resumes
  FOR ALL USING (auth_role() = 'learner' AND user_id = auth.uid());

-- companies + roles: learners can read (needed for placement dashboard)
CREATE POLICY learner_read ON public.companies
  FOR SELECT USING (auth_role() = 'learner');
CREATE POLICY learner_read ON public.roles
  FOR SELECT USING (auth_role() = 'learner');

-- Everything else: learners have NO access
-- (alumni, alumni_jobs, job_personas, job_opportunities, sync_logs,
--  settings, interventions, metrics, metric_sources, metric_source_columns,
--  metric_raw_rows — all blocked for learners by default since RLS is
--  enabled and no learner policy exists)
