-- 059: Challenge review — the challenge→interview selection gate.
--
-- Two artefacts:
--
-- 1. challenge_review_config — the editable thresholds the rule engine uses to
--    compute a SYSTEM decision (selected/rejected) for each candidate. Seeded with
--    the current numbers; admins can tune them from the Review tab. One row per
--    (cohort_id, course_id) so different challenges can have different bars.
--    Operators are fixed in code (lib/challengeReview.ts): attempted > min,
--    active > min, span >= min, cramming < max. Only the numeric bounds live here.
--
-- 2. challenge_decisions — the TEAM's verified verdict per candidate. The system
--    decision is computed live on every render (from synced metric_raw_rows); we
--    only persist a row once a human acts. `final_decision` is what the candidate
--    portal reads — never the machine call alone. We snapshot the system decision +
--    per-criterion results at verification time so (a) rejection feedback is stable
--    and (b) we can flag when the system later changes its mind vs the human verdict.
--
-- Candidate identity across the whole challenge pipeline is the normalised email
-- (lower(trim(email))), matching prospects / prospect_comments.

CREATE TABLE IF NOT EXISTS public.challenge_review_config (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id               integer NOT NULL,
  course_id               integer NOT NULL,
  min_attempted_questions integer NOT NULL DEFAULT 100,   -- attempted questions must be > this
  min_active_days         integer NOT NULL DEFAULT 10,    -- active days must be > this
  min_span_days           integer NOT NULL DEFAULT 14,    -- span (first→last) must be >= this
  max_cramming_pct        integer NOT NULL DEFAULT 30,    -- cramming % must be < this
  updated_by              uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, course_id)
);

-- Seed the current 14-Day Challenge (2026) with the agreed starting thresholds.
INSERT INTO public.challenge_review_config
  (cohort_id, course_id, min_attempted_questions, min_active_days, min_span_days, max_cramming_pct)
VALUES (214, 587, 100, 10, 14, 30)
ON CONFLICT (cohort_id, course_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.challenge_decisions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                    text    NOT NULL,                 -- normalised: lower(trim(email))
  cohort_id                integer NOT NULL,
  course_id                integer NOT NULL,
  final_decision           text    NOT NULL CHECK (final_decision IN ('selected', 'rejected')),
  reason                   text,                             -- required when overriding the system
  overrode_system          boolean NOT NULL DEFAULT false,   -- team's verdict != system's at decision time
  system_decision_at_verify text CHECK (system_decision_at_verify IN ('selected', 'rejected')),
  criteria_snapshot        jsonb   NOT NULL DEFAULT '[]'::jsonb,  -- [{key,label,status,value,threshold,failFeedback}]
  decided_by               uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decided_by_name          text,                             -- snapshot for display
  decided_at               timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, cohort_id, course_id)
);

-- The candidate portal reads by (email, cohort, course); the admin table filters by
-- final_decision. Index both access paths.
CREATE INDEX IF NOT EXISTS challenge_decisions_email_idx
  ON public.challenge_decisions (email);
CREATE INDEX IF NOT EXISTS challenge_decisions_final_idx
  ON public.challenge_decisions (final_decision);

ALTER TABLE public.challenge_review_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_decisions     ENABLE ROW LEVEL SECURITY;

-- Admin/staff only (same rule as prospects). App writes go through the service-role
-- client (bypasses RLS); these policies are the backstop. The candidate portal reads
-- its own decision via the service-role client filtered by the authed email.
DROP POLICY IF EXISTS staff_all ON public.challenge_review_config;
CREATE POLICY staff_all ON public.challenge_review_config
  USING (public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text]));

DROP POLICY IF EXISTS staff_all ON public.challenge_decisions;
CREATE POLICY staff_all ON public.challenge_decisions
  USING (public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text]));
