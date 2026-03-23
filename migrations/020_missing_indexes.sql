-- ============================================================
-- Migration 020: Missing performance indexes
-- Run in Supabase SQL Editor
-- ============================================================

-- applications.user_id
-- Used in: dashboard + analytics filtered queries (WHERE user_id = ANY(...))
CREATE INDEX IF NOT EXISTS idx_applications_user_id
  ON public.applications(user_id);

-- role_preferences(user_id, preference)
-- Used in: dashboard + analytics (WHERE user_id = ANY(...) AND preference = 'not_interested')
CREATE INDEX IF NOT EXISTS idx_role_preferences_user_id_preference
  ON public.role_preferences(user_id, preference);

-- learners.lf_name
-- Used in: dashboard + analytics filter dropdowns (.eq('lf_name', lf))
CREATE INDEX IF NOT EXISTS idx_learners_lf_name
  ON public.learners(lf_name);
