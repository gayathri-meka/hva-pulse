-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL,
  learner_id text NOT NULL,
  status text NOT NULL DEFAULT 'applied'::text CHECK (status = ANY (ARRAY['applied'::text, 'shortlisted'::text, 'interviews_ongoing'::text, 'on_hold'::text, 'not_shortlisted'::text, 'rejected'::text, 'hired'::text])),
  resume_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid,
  not_shortlisted_reason text,
  rejection_feedback text,
  not_shortlisted_reasons ARRAY DEFAULT '{}'::text[],
  rejection_reasons ARRAY DEFAULT '{}'::text[],
  shortlisting_decision_taken_at timestamp with time zone,
  interviews_started_at timestamp with time zone,
  hiring_decision_taken_at timestamp with time zone,
  CONSTRAINT applications_pkey PRIMARY KEY (id),
  CONSTRAINT applications_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sort_order integer,
  CONSTRAINT companies_pkey PRIMARY KEY (id)
);
CREATE TABLE public.job_opportunities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  persona_id uuid,
  job_title text NOT NULL,
  company_name text NOT NULL,
  location text,
  source_platform text NOT NULL,
  date_posted date,
  job_description text,
  match_reasoning text,
  original_url text,
  external_id text,
  status text DEFAULT 'discovered'::text CHECK (status = ANY (ARRAY['discovered'::text, 'reviewed'::text, 'approved'::text, 'rejected'::text])),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT job_opportunities_pkey PRIMARY KEY (id),
  CONSTRAINT job_opportunities_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.job_personas(id)
);
CREATE TABLE public.job_personas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_job_titles ARRAY DEFAULT '{}'::text[],
  required_skills ARRAY DEFAULT '{}'::text[],
  experience_min integer,
  experience_max integer,
  preferred_locations ARRAY DEFAULT '{}'::text[],
  remote_allowed boolean DEFAULT false,
  platforms ARRAY DEFAULT '{}'::text[],
  active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  entry_level_only boolean DEFAULT false,
  CONSTRAINT job_personas_pkey PRIMARY KEY (id),
  CONSTRAINT job_personas_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.learners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  learner_id text UNIQUE,
  phone_number text,
  category text,
  lf_name text,
  status text,
  batch_name text,
  tech_mentor_name text,
  core_skills_mentor_name text,
  track text,
  join_date date,
  updated_at timestamp without time zone DEFAULT now(),
  user_id uuid NOT NULL,
  lf_user_id uuid,
  year_of_graduation integer,
  degree text,
  specialisation text,
  current_location text,
  prs numeric,
  readiness text,
  blacklisted_date date,
  proactiveness numeric,
  articulation numeric,
  comprehension numeric,
  tech_score numeric,
  new_lf text,
  fy_year text,
  CONSTRAINT learners_pkey PRIMARY KEY (user_id),
  CONSTRAINT learners_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT learners_lf_user_id_fkey FOREIGN KEY (lf_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.resumes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_url text NOT NULL,
  version_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT resumes_pkey PRIMARY KEY (id),
  CONSTRAINT resumes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.role_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  preference text NOT NULL CHECK (preference = 'not_interested'::text),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reasons ARRAY NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT role_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT role_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT role_preferences_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id)
);
CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  role_title text NOT NULL,
  location text NOT NULL,
  salary_range text,
  job_description text NOT NULL,
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'closed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  jd_attachment_url text,
  CONSTRAINT roles_pkey PRIMARY KEY (id),
  CONSTRAINT roles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
CREATE TABLE public.sync_logs (
  sheet_key text NOT NULL,
  last_synced_at timestamp with time zone NOT NULL DEFAULT now(),
  records_synced integer NOT NULL DEFAULT 0,
  CONSTRAINT sync_logs_pkey PRIMARY KEY (sheet_key)
);
CREATE TABLE public.alumni (
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id           uuid,
  learner_id        text UNIQUE,
  name              text NOT NULL,
  email             text,
  fy_year           text NOT NULL,
  employment_status text NOT NULL DEFAULT 'employed'::text CHECK (employment_status = ANY (ARRAY['employed'::text, 'unemployed'::text])),
  contact_number    text,
  created_at        timestamp with time zone NOT NULL DEFAULT now(),
  updated_at        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT alumni_pkey PRIMARY KEY (id),
  CONSTRAINT alumni_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT alumni_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(learner_id)
);
CREATE TABLE public.alumni_jobs (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  alumni_id       uuid NOT NULL,
  company         text NOT NULL,
  role            text NOT NULL,
  salary          numeric,
  placement_month date,
  is_current      boolean NOT NULL DEFAULT true,
  start_date      date,
  end_date        date,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT alumni_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT alumni_jobs_alumni_id_fkey FOREIGN KEY (alumni_id) REFERENCES public.alumni(id) ON DELETE CASCADE
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin'::text, 'LF'::text, 'learner'::text])),
  created_at timestamp without time zone DEFAULT now(),
  name text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
