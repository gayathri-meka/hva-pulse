-- Pre-computed learner analysis from sensai BigQuery data.
-- raw_data: structured JSON aggregates (machine-generated from BQ)
-- analysis_text: free-form written findings (human/AI-generated)

CREATE TABLE IF NOT EXISTS public.learner_analysis (
  learner_id    text        NOT NULL PRIMARY KEY REFERENCES public.learners(learner_id) ON DELETE CASCADE,
  email         text        NOT NULL,
  raw_data      jsonb       NOT NULL DEFAULT '{}',
  analysis_text text,
  computed_at   timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS: staff can read/write, learners blocked
ALTER TABLE public.learner_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_all ON public.learner_analysis FOR ALL USING (auth_role() IN ('admin', 'staff'));
