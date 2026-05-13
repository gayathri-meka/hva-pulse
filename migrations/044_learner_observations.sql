-- 044: Subjective observations log per learner. Free-form text, dated, attributed
-- to the staff member who logged it. Independent of interventions — observations
-- accumulate as a journal and may later prompt starting an intervention.

CREATE TABLE IF NOT EXISTS learner_observations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id  text        NOT NULL REFERENCES learners(learner_id) ON DELETE CASCADE,
  author_id   uuid        NOT NULL REFERENCES users(id),
  observed_at date        NOT NULL,
  note        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learner_observations_learner_id_idx
  ON learner_observations(learner_id);

CREATE INDEX IF NOT EXISTS learner_observations_observed_at_idx
  ON learner_observations(observed_at DESC);
