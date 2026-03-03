-- ============================================================
-- Migration 007: Performance indexes
-- Run in Supabase SQL Editor
-- ============================================================

-- applications.role_id
-- Used in: matching page (filter by role), companies page (count per role)
CREATE INDEX IF NOT EXISTS idx_applications_role_id
  ON public.applications(role_id);

-- applications(role_id, status)
-- Composite index covers queries that filter by both columns (matching + analytics)
CREATE INDEX IF NOT EXISTS idx_applications_role_id_status
  ON public.applications(role_id, status);

-- applications.status
-- Used in: analytics page (group by status), companies page (hired/applied counts)
CREATE INDEX IF NOT EXISTS idx_applications_status
  ON public.applications(status);

-- role_preferences.role_id
-- Used in: matching page (not-interested set per role)
CREATE INDEX IF NOT EXISTS idx_role_preferences_role_id
  ON public.role_preferences(role_id);

-- learners.lf_user_id
-- Used in: dashboard page (LF users filter their own learners),
--          learners page (.eq('lf_user_id', ...))
CREATE INDEX IF NOT EXISTS idx_learners_lf_user_id
  ON public.learners(lf_user_id);

-- learners.batch_name
-- Used in: learners page (.eq('batch_name', ...))
CREATE INDEX IF NOT EXISTS idx_learners_batch_name
  ON public.learners(batch_name);

-- users(email, role) — covers is_admin() SECURITY DEFINER function
-- is_admin() queries: WHERE email = auth.jwt()->>'email' AND role = 'admin'
-- users.email already has a unique index; this composite index lets Postgres
-- satisfy the role = 'admin' check without a table fetch on every RLS evaluation.
CREATE INDEX IF NOT EXISTS idx_users_email_role
  ON public.users(email, role);
