-- 047: Structured metadata on learner_observations. Each new observation is
-- tagged with a type (signal direction), category (theme), severity (for
-- concerns), and accountable team (routing hint). All columns are nullable so
-- pre-existing observations stay valid; the UI requires them only on create.
--
-- The category list is admin-editable from /learning/settings/configurations,
-- backed by the existing `settings` table (key = 'observation_categories').

ALTER TABLE public.learner_observations
  ADD COLUMN IF NOT EXISTS type             text,
  ADD COLUMN IF NOT EXISTS category         text,
  ADD COLUMN IF NOT EXISTS severity         text,
  ADD COLUMN IF NOT EXISTS accountable_team text;

DO $$ BEGIN
  ALTER TABLE public.learner_observations
    ADD CONSTRAINT learner_observations_type_check
    CHECK (type IS NULL OR type IN ('Positive', 'Neutral', 'Concern'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.learner_observations
    ADD CONSTRAINT learner_observations_severity_check
    CHECK (severity IS NULL OR severity IN ('Low', 'Medium', 'High'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.learner_observations
    ADD CONSTRAINT learner_observations_accountable_team_check
    CHECK (accountable_team IS NULL OR accountable_team IN ('Program', 'Learning'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Severity must accompany Concerns and only Concerns.
DO $$ BEGIN
  ALTER TABLE public.learner_observations
    ADD CONSTRAINT learner_observations_severity_for_concern_check
    CHECK (
      (type = 'Concern' AND severity IS NOT NULL)
      OR (type <> 'Concern' AND severity IS NULL)
      OR type IS NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS learner_observations_type_idx     ON public.learner_observations(type);
CREATE INDEX IF NOT EXISTS learner_observations_category_idx ON public.learner_observations(category);
