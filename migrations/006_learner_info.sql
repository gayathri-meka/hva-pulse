-- New columns on learners table (from Learner Info Google Sheet)
ALTER TABLE learners ADD COLUMN IF NOT EXISTS year_of_graduation INT;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS degree             TEXT;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS specialisation     TEXT;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS current_location   TEXT;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS prs                NUMERIC;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS readiness          TEXT;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS blacklisted_date   DATE;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS proactiveness      NUMERIC;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS articulation       NUMERIC;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS comprehension      NUMERIC;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS tech_score         NUMERIC;

-- Tracks last sync time per sheet
CREATE TABLE IF NOT EXISTS sync_logs (
  sheet_key      TEXT        PRIMARY KEY,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  records_synced INT         NOT NULL DEFAULT 0
);
