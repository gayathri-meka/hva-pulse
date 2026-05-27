-- 049: Case redesign — severity, accountable team, triggers (observations and
-- metric snapshots), and removal of the legacy singular root_cause_category.
--
-- Nothing here is destructive for live cases except the legacy column drop,
-- which has been unused since migration 038 superseded it with the plural
-- root_cause_categories array.

-- ── Case-level severity ───────────────────────────────────────────────────────
-- Severity describes the seriousness of "what's wrong". Nullable so existing
-- cases stay valid; the UI prompts staff to set it on new cases.
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS severity text
  CHECK (severity IS NULL OR severity IN ('Low','Medium','High'));

-- ── Accountable team ──────────────────────────────────────────────────────────
-- Manual for now. The UI may auto-suggest from attached observations later.
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS accountable_team text
  CHECK (accountable_team IS NULL OR accountable_team IN ('Program','Learning'));

-- ── Triggers ──────────────────────────────────────────────────────────────────
-- Many-to-many. A trigger is either an observation OR a metric snapshot —
-- enforced by the CHECK so each row carries exactly one of the two FKs.
--
-- metric_period_label is free text (e.g. "Week of 19 May") snapshotted at the
-- moment the trigger was attached so we don't need to recompute which period
-- was "off" later. metric_value is the value at attach time, same idea.
CREATE TABLE IF NOT EXISTS public.case_triggers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             uuid NOT NULL REFERENCES public.cases(id)                 ON DELETE CASCADE,
  kind                text NOT NULL CHECK (kind IN ('observation','metric')),
  observation_id      uuid REFERENCES public.learner_observations(id)           ON DELETE SET NULL,
  metric_id           uuid REFERENCES public.metrics(id)                        ON DELETE SET NULL,
  metric_period_label text,
  metric_value        numeric,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES public.users(id),
  CONSTRAINT case_triggers_one_kind CHECK (
    (kind = 'observation' AND observation_id IS NOT NULL AND metric_id IS NULL)
    OR
    (kind = 'metric'      AND metric_id      IS NOT NULL AND observation_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS case_triggers_case_idx
  ON public.case_triggers(case_id);

-- Lookups in the opposite direction ("which cases is this observation linked
-- to?") only make sense for observation triggers.
CREATE INDEX IF NOT EXISTS case_triggers_obs_idx
  ON public.case_triggers(observation_id) WHERE observation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS case_triggers_metric_idx
  ON public.case_triggers(metric_id) WHERE metric_id IS NOT NULL;

ALTER TABLE public.case_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_all ON public.case_triggers;
CREATE POLICY staff_all ON public.case_triggers
  FOR ALL USING (auth_role() IN ('admin','staff'));

-- ── Cleanup: legacy column ────────────────────────────────────────────────────
-- root_cause_category (singular) was deprecated by migration 038 in favour of
-- the root_cause_categories array. Nothing reads it any more.
ALTER TABLE public.cases DROP COLUMN IF EXISTS root_cause_category;
