CREATE TABLE job_personas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  target_job_titles text[] DEFAULT '{}',
  required_skills   text[] DEFAULT '{}',
  experience_min  integer,
  experience_max  integer,
  preferred_locations text[] DEFAULT '{}',
  remote_allowed  boolean DEFAULT false,
  platforms       text[] DEFAULT '{}',  -- e.g. ['linkedin','naukri','internshala']
  active          boolean DEFAULT true,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE job_opportunities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id      uuid REFERENCES job_personas(id) ON DELETE SET NULL,
  job_title       text NOT NULL,
  company_name    text NOT NULL,
  location        text,
  source_platform text NOT NULL,   -- 'jooble' | 'manual'
  date_posted     date,
  job_description text,
  match_reasoning text,
  original_url    text,
  external_id     text,            -- platform job ID for dedup
  status          text DEFAULT 'discovered'
                  CHECK (status IN ('discovered','reviewed','approved','rejected')),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (source_platform, external_id)
);

-- RLS: admin-only write, any authenticated read
ALTER TABLE job_personas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage personas"
  ON job_personas FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "authenticated read personas"
  ON job_personas FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins manage opportunities"
  ON job_opportunities FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "authenticated read opportunities"
  ON job_opportunities FOR SELECT TO authenticated USING (true);
