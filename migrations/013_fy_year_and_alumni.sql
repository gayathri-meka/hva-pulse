-- Add FY year to learners
ALTER TABLE public.learners ADD COLUMN IF NOT EXISTS fy_year text;

-- Alumni (one row per person)
CREATE TABLE public.alumni (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES public.users(id),
  learner_id        text UNIQUE REFERENCES public.learners(learner_id),
  name              text NOT NULL,
  email             text,
  fy_year           text NOT NULL,
  employment_status text NOT NULL DEFAULT 'employed'
    CHECK (employment_status IN ('employed', 'unemployed')),
  contact_number    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Employment history (many per alumni)
CREATE TABLE public.alumni_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumni_id       uuid NOT NULL REFERENCES public.alumni(id) ON DELETE CASCADE,
  company         text NOT NULL,
  role            text NOT NULL,
  salary          numeric,
  placement_month date,
  is_current      boolean NOT NULL DEFAULT true,
  start_date      date,
  end_date        date,
  created_at      timestamptz NOT NULL DEFAULT now()
);
