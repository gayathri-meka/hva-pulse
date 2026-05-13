-- 045: RLS policies for learner_observations. Admin + staff can read/write;
-- everyone else is blocked. Mirrors the pattern used by learner_analysis (034).

ALTER TABLE public.learner_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_all ON public.learner_observations;
CREATE POLICY staff_all ON public.learner_observations
  FOR ALL USING (auth_role() IN ('admin', 'staff'));
