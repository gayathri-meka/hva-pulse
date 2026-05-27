-- Generated with: pg_dump --schema-only --schema=public --no-owner --no-acl
-- against the project DB via MCP_DATABASE_URL (read-only pulse_mcp_ro role).
-- See feedback_schema_dump_discipline memory: regen after every migration.

--
-- PostgreSQL database dump
--

\restrict w1vm2qcebxdfsMglVRB2tbLXUgPbB7iceHz0iSoIWwjdbYwlJOBqV1oI4fGBOiC

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: auth_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auth_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email'
$$;


--
-- Name: current_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT id FROM public.users WHERE email = auth.jwt()->>'email'
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE email = auth.jwt()->>'email' AND role = 'admin'
  );
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
 BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alumni; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alumni (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    learner_id text,
    name text NOT NULL,
    email text,
    cohort_fy text NOT NULL,
    employment_status text DEFAULT 'employed'::text NOT NULL,
    contact_number text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    placed_fy text,
    CONSTRAINT alumni_employment_status_check CHECK ((employment_status = ANY (ARRAY['employed'::text, 'unemployed'::text])))
);


--
-- Name: alumni_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alumni_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alumni_id uuid NOT NULL,
    company text NOT NULL,
    role text NOT NULL,
    salary numeric,
    placement_month date,
    is_current boolean DEFAULT true NOT NULL,
    start_date date,
    end_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    starting_salary numeric
);


--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    learner_id text NOT NULL,
    status text DEFAULT 'applied'::text NOT NULL,
    resume_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    not_shortlisted_reason text,
    rejection_feedback text,
    not_shortlisted_reasons text[] DEFAULT '{}'::text[],
    rejection_reasons text[] DEFAULT '{}'::text[],
    shortlisting_decision_taken_at timestamp with time zone,
    interviews_started_at timestamp with time zone,
    hiring_decision_taken_at timestamp with time zone,
    salary_lpa numeric,
    CONSTRAINT applications_status_check CHECK ((status = ANY (ARRAY['applied'::text, 'shortlisted'::text, 'interviews_ongoing'::text, 'on_hold'::text, 'not_shortlisted'::text, 'rejected'::text, 'hired'::text])))
);


--
-- Name: case_triggers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_triggers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    kind text NOT NULL,
    observation_id uuid,
    metric_id uuid,
    metric_period_label text,
    metric_value numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT case_triggers_kind_check CHECK ((kind = ANY (ARRAY['observation'::text, 'metric'::text]))),
    CONSTRAINT case_triggers_one_kind CHECK ((((kind = 'observation'::text) AND (observation_id IS NOT NULL) AND (metric_id IS NULL)) OR ((kind = 'metric'::text) AND (metric_id IS NOT NULL) AND (observation_id IS NULL))))
);


--
-- Name: cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    learner_id text NOT NULL,
    opened_by uuid,
    status text DEFAULT 'open'::text NOT NULL,
    root_cause_notes text,
    step1_completed_at timestamp with time zone,
    interventions jsonb DEFAULT '[]'::jsonb NOT NULL,
    step2_completed_at timestamp with time zone,
    decision_date date,
    last_reviewed_at timestamp with time zone,
    outcome text,
    outcome_note text,
    closed_at timestamp with time zone,
    closed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    update_log jsonb DEFAULT '[]'::jsonb NOT NULL,
    flagged_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    what_wrong_notes text,
    step3_completed_at timestamp with time zone,
    root_cause_categories jsonb DEFAULT '[]'::jsonb NOT NULL,
    what_wrong_comments jsonb DEFAULT '[]'::jsonb NOT NULL,
    why_comments jsonb DEFAULT '[]'::jsonb NOT NULL,
    root_cause_type text,
    severity text,
    accountable_team text,
    CONSTRAINT cases_accountable_team_check CHECK (((accountable_team IS NULL) OR (accountable_team = ANY (ARRAY['Program'::text, 'Learning'::text])))),
    CONSTRAINT cases_severity_check CHECK (((severity IS NULL) OR (severity = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text])))),
    CONSTRAINT cases_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'follow_up'::text, 'closed'::text]))),
    CONSTRAINT interventions_root_cause_type_check CHECK ((root_cause_type = ANY (ARRAY['time'::text, 'learning'::text, 'both'::text, 'other'::text]))),
    CONSTRAINT learning_interventions_outcome_check CHECK ((outcome = ANY (ARRAY['resolved'::text, 'dropped'::text, 'other'::text])))
);


--
-- Name: cohort_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cohort_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cohort_fy text NOT NULL,
    onboarded integer DEFAULT 0 NOT NULL,
    dropouts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sort_order integer
);


--
-- Name: job_opportunities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_opportunities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
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
    status text DEFAULT 'discovered'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT job_opportunities_status_check CHECK ((status = ANY (ARRAY['discovered'::text, 'reviewed'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: job_personas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_personas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    target_job_titles text[] DEFAULT '{}'::text[],
    required_skills text[] DEFAULT '{}'::text[],
    experience_min integer,
    experience_max integer,
    preferred_locations text[] DEFAULT '{}'::text[],
    remote_allowed boolean DEFAULT false,
    platforms text[] DEFAULT '{}'::text[],
    active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    entry_level_only boolean DEFAULT false
);


--
-- Name: learner_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learner_analysis (
    learner_id text NOT NULL,
    email text NOT NULL,
    raw_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    analysis_text text,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: learner_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learner_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    name text NOT NULL,
    phone text NOT NULL,
    email text NOT NULL,
    college_name text NOT NULL,
    educational_status text
);


--
-- Name: learner_observations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learner_observations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    learner_id text NOT NULL,
    author_id uuid NOT NULL,
    observed_at date NOT NULL,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    type text,
    category text,
    severity text,
    accountable_team text,
    CONSTRAINT learner_observations_accountable_team_check CHECK (((accountable_team IS NULL) OR (accountable_team = ANY (ARRAY['Program'::text, 'Learning'::text])))),
    CONSTRAINT learner_observations_severity_check CHECK (((severity IS NULL) OR (severity = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text])))),
    CONSTRAINT learner_observations_severity_for_concern_check CHECK ((((type = 'Concern'::text) AND (severity IS NOT NULL)) OR ((type <> 'Concern'::text) AND (severity IS NULL)) OR (type IS NULL))),
    CONSTRAINT learner_observations_type_check CHECK (((type IS NULL) OR (type = ANY (ARRAY['Positive'::text, 'Neutral'::text, 'Concern'::text]))))
);


--
-- Name: learners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    learner_id text,
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
    cohort_fy text,
    placed_fy text,
    is_current_cohort boolean DEFAULT false NOT NULL,
    sub_cohort text,
    new_batch text,
    new_mentor text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: mentor_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentor_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    name text NOT NULL,
    phone text NOT NULL,
    linkedin text NOT NULL,
    company text NOT NULL,
    role text NOT NULL,
    heard_from text
);


--
-- Name: metric_raw_rows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metric_raw_rows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id uuid NOT NULL,
    learner_id text NOT NULL,
    dimensions jsonb DEFAULT '{}'::jsonb NOT NULL,
    value text
);


--
-- Name: metric_source_columns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metric_source_columns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id uuid NOT NULL,
    column_name text NOT NULL,
    role text NOT NULL,
    label text,
    CONSTRAINT metric_source_columns_role_check CHECK ((role = ANY (ARRAY['learner_id'::text, 'value'::text, 'dimension'::text, 'ignored'::text])))
);


--
-- Name: metric_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metric_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sheet_id text,
    sheet_tab text,
    last_synced_at timestamp with time zone,
    row_count integer,
    sync_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source_type text DEFAULT 'sheet'::text NOT NULL,
    bq_project text,
    bq_dataset text,
    bq_table text,
    bq_filter text,
    CONSTRAINT metric_sources_source_type_check CHECK ((source_type = ANY (ARRAY['sheet'::text, 'bigquery'::text]))),
    CONSTRAINT metric_sources_type_fields_chk CHECK ((((source_type = 'sheet'::text) AND (sheet_id IS NOT NULL) AND (sheet_tab IS NOT NULL)) OR ((source_type = 'bigquery'::text) AND (bq_project IS NOT NULL) AND (bq_dataset IS NOT NULL) AND (bq_table IS NOT NULL))))
);


--
-- Name: metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    source_id uuid,
    aggregation text,
    filters jsonb DEFAULT '[]'::jsonb NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    time_dimension text,
    time_sort_order text,
    kind text DEFAULT 'simple'::text NOT NULL,
    composite_inputs jsonb DEFAULT '[]'::jsonb NOT NULL,
    fill_gaps boolean DEFAULT true NOT NULL,
    filter_logic text DEFAULT 'and'::text NOT NULL,
    CONSTRAINT metrics_aggregation_check CHECK ((aggregation = ANY (ARRAY['COUNT'::text, 'SUM'::text, 'AVG'::text, 'MIN'::text, 'MAX'::text]))),
    CONSTRAINT metrics_filter_logic_check CHECK ((filter_logic = ANY (ARRAY['and'::text, 'or'::text]))),
    CONSTRAINT metrics_kind_check CHECK ((kind = ANY (ARRAY['simple'::text, 'composite'::text]))),
    CONSTRAINT metrics_kind_fields_chk CHECK ((((kind = 'simple'::text) AND (source_id IS NOT NULL) AND (aggregation IS NOT NULL)) OR ((kind = 'composite'::text) AND (jsonb_array_length(composite_inputs) > 0)))),
    CONSTRAINT metrics_time_sort_order_check CHECK ((time_sort_order = ANY (ARRAY['alphabetical'::text, 'chronological'::text, 'numerical'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prospects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: resumes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resumes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    file_url text NOT NULL,
    version_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: role_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    preference text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reasons text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT role_preferences_preference_check CHECK ((preference = 'not_interested'::text))
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    role_title text NOT NULL,
    location text NOT NULL,
    salary_range text,
    job_description text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    jd_attachment_url text,
    CONSTRAINT roles_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_logs (
    sheet_key text NOT NULL,
    last_synced_at timestamp with time zone DEFAULT now() NOT NULL,
    records_synced integer DEFAULT 0 NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    name text,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'staff'::text, 'guest'::text, 'learner'::text])))
);


--
-- Name: alumni_jobs alumni_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumni_jobs
    ADD CONSTRAINT alumni_jobs_pkey PRIMARY KEY (id);


--
-- Name: alumni alumni_learner_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumni
    ADD CONSTRAINT alumni_learner_id_key UNIQUE (learner_id);


--
-- Name: alumni alumni_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumni
    ADD CONSTRAINT alumni_pkey PRIMARY KEY (id);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: applications applications_role_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_role_id_user_id_key UNIQUE (role_id, user_id);


--
-- Name: case_triggers case_triggers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_triggers
    ADD CONSTRAINT case_triggers_pkey PRIMARY KEY (id);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY (id);


--
-- Name: cohort_stats cohort_stats_cohort_fy_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_stats
    ADD CONSTRAINT cohort_stats_cohort_fy_key UNIQUE (cohort_fy);


--
-- Name: cohort_stats cohort_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_stats
    ADD CONSTRAINT cohort_stats_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: job_opportunities job_opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_opportunities
    ADD CONSTRAINT job_opportunities_pkey PRIMARY KEY (id);


--
-- Name: job_opportunities job_opportunities_source_platform_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_opportunities
    ADD CONSTRAINT job_opportunities_source_platform_external_id_key UNIQUE NULLS NOT DISTINCT (source_platform, external_id);


--
-- Name: job_personas job_personas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_personas
    ADD CONSTRAINT job_personas_pkey PRIMARY KEY (id);


--
-- Name: learner_analysis learner_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_analysis
    ADD CONSTRAINT learner_analysis_pkey PRIMARY KEY (learner_id);


--
-- Name: learner_applications learner_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_applications
    ADD CONSTRAINT learner_applications_pkey PRIMARY KEY (id);


--
-- Name: learner_observations learner_observations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_observations
    ADD CONSTRAINT learner_observations_pkey PRIMARY KEY (id);


--
-- Name: learners learners_learner_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learners
    ADD CONSTRAINT learners_learner_id_unique UNIQUE (learner_id);


--
-- Name: learners learners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learners
    ADD CONSTRAINT learners_pkey PRIMARY KEY (user_id);


--
-- Name: mentor_applications mentor_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_applications
    ADD CONSTRAINT mentor_applications_pkey PRIMARY KEY (id);


--
-- Name: metric_raw_rows metric_raw_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metric_raw_rows
    ADD CONSTRAINT metric_raw_rows_pkey PRIMARY KEY (id);


--
-- Name: metric_source_columns metric_source_columns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metric_source_columns
    ADD CONSTRAINT metric_source_columns_pkey PRIMARY KEY (id);


--
-- Name: metric_source_columns metric_source_columns_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metric_source_columns
    ADD CONSTRAINT metric_source_columns_unique UNIQUE (source_id, column_name);


--
-- Name: metric_sources metric_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metric_sources
    ADD CONSTRAINT metric_sources_pkey PRIMARY KEY (id);


--
-- Name: metrics metrics_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics
    ADD CONSTRAINT metrics_name_key UNIQUE (name);


--
-- Name: metrics metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics
    ADD CONSTRAINT metrics_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: prospects prospects_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_email_key UNIQUE (email);


--
-- Name: prospects prospects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_pkey PRIMARY KEY (id);


--
-- Name: resumes resumes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT resumes_pkey PRIMARY KEY (id);


--
-- Name: role_preferences role_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_preferences
    ADD CONSTRAINT role_preferences_pkey PRIMARY KEY (id);


--
-- Name: role_preferences role_preferences_user_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_preferences
    ADD CONSTRAINT role_preferences_user_id_role_id_key UNIQUE (user_id, role_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: sync_logs sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_logs
    ADD CONSTRAINT sync_logs_pkey PRIMARY KEY (sheet_key);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: case_triggers_case_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX case_triggers_case_idx ON public.case_triggers USING btree (case_id);


--
-- Name: case_triggers_metric_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX case_triggers_metric_idx ON public.case_triggers USING btree (metric_id) WHERE (metric_id IS NOT NULL);


--
-- Name: case_triggers_obs_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX case_triggers_obs_idx ON public.case_triggers USING btree (observation_id) WHERE (observation_id IS NOT NULL);


--
-- Name: cases_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cases_active_idx ON public.cases USING btree (learner_id) WHERE (status <> 'closed'::text);


--
-- Name: cases_decision_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_decision_idx ON public.cases USING btree (decision_date) WHERE (status = 'monitoring'::text);


--
-- Name: cases_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_status_idx ON public.cases USING btree (status);


--
-- Name: idx_applications_learner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_learner_id ON public.applications USING btree (learner_id);


--
-- Name: idx_applications_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_role_id ON public.applications USING btree (role_id);


--
-- Name: idx_applications_role_id_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_role_id_status ON public.applications USING btree (role_id, status);


--
-- Name: idx_applications_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_status ON public.applications USING btree (status);


--
-- Name: idx_applications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_user_id ON public.applications USING btree (user_id);


--
-- Name: idx_learners_batch_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learners_batch_name ON public.learners USING btree (batch_name);


--
-- Name: idx_learners_is_current_cohort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learners_is_current_cohort ON public.learners USING btree (is_current_cohort);


--
-- Name: idx_learners_lf_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learners_lf_name ON public.learners USING btree (lf_name);


--
-- Name: idx_learners_lf_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learners_lf_user_id ON public.learners USING btree (lf_user_id);


--
-- Name: idx_learners_sub_cohort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learners_sub_cohort ON public.learners USING btree (sub_cohort);


--
-- Name: idx_metric_raw_rows_dimensions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metric_raw_rows_dimensions ON public.metric_raw_rows USING gin (dimensions);


--
-- Name: idx_metric_raw_rows_source_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metric_raw_rows_source_learner ON public.metric_raw_rows USING btree (source_id, learner_id);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_resumes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumes_user_id ON public.resumes USING btree (user_id);


--
-- Name: idx_role_preferences_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_preferences_role_id ON public.role_preferences USING btree (role_id);


--
-- Name: idx_role_preferences_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_preferences_user_id ON public.role_preferences USING btree (user_id);


--
-- Name: idx_role_preferences_user_id_preference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_preferences_user_id_preference ON public.role_preferences USING btree (user_id, preference);


--
-- Name: idx_roles_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_company_id ON public.roles USING btree (company_id);


--
-- Name: idx_users_email_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email_role ON public.users USING btree (email, role);


--
-- Name: learner_observations_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learner_observations_category_idx ON public.learner_observations USING btree (category);


--
-- Name: learner_observations_learner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learner_observations_learner_id_idx ON public.learner_observations USING btree (learner_id);


--
-- Name: learner_observations_observed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learner_observations_observed_at_idx ON public.learner_observations USING btree (observed_at DESC);


--
-- Name: learner_observations_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learner_observations_type_idx ON public.learner_observations USING btree (type);


--
-- Name: learners_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learners_is_active_idx ON public.learners USING btree (is_active);


--
-- Name: prospects_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prospects_created_at_idx ON public.prospects USING btree (created_at DESC);


--
-- Name: applications trg_applications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: alumni_jobs alumni_jobs_alumni_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumni_jobs
    ADD CONSTRAINT alumni_jobs_alumni_id_fkey FOREIGN KEY (alumni_id) REFERENCES public.alumni(id) ON DELETE CASCADE;


--
-- Name: alumni alumni_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumni
    ADD CONSTRAINT alumni_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(learner_id);


--
-- Name: alumni alumni_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumni
    ADD CONSTRAINT alumni_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: applications applications_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: applications applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: case_triggers case_triggers_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_triggers
    ADD CONSTRAINT case_triggers_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_triggers case_triggers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_triggers
    ADD CONSTRAINT case_triggers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: case_triggers case_triggers_metric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_triggers
    ADD CONSTRAINT case_triggers_metric_id_fkey FOREIGN KEY (metric_id) REFERENCES public.metrics(id) ON DELETE SET NULL;


--
-- Name: case_triggers case_triggers_observation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_triggers
    ADD CONSTRAINT case_triggers_observation_id_fkey FOREIGN KEY (observation_id) REFERENCES public.learner_observations(id) ON DELETE SET NULL;


--
-- Name: cases cases_closer_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_closer_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id);


--
-- Name: cases cases_learner_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_learner_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(learner_id) ON DELETE CASCADE;


--
-- Name: cases cases_opener_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_opener_fkey FOREIGN KEY (opened_by) REFERENCES public.users(id);


--
-- Name: job_opportunities job_opportunities_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_opportunities
    ADD CONSTRAINT job_opportunities_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.job_personas(id) ON DELETE SET NULL;


--
-- Name: job_personas job_personas_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_personas
    ADD CONSTRAINT job_personas_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: learner_analysis learner_analysis_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_analysis
    ADD CONSTRAINT learner_analysis_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(learner_id) ON DELETE CASCADE;


--
-- Name: learner_observations learner_observations_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_observations
    ADD CONSTRAINT learner_observations_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: learner_observations learner_observations_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_observations
    ADD CONSTRAINT learner_observations_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(learner_id) ON DELETE CASCADE;


--
-- Name: learners learners_lf_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learners
    ADD CONSTRAINT learners_lf_user_id_fkey FOREIGN KEY (lf_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: learners learners_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learners
    ADD CONSTRAINT learners_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: metric_raw_rows metric_raw_rows_source_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metric_raw_rows
    ADD CONSTRAINT metric_raw_rows_source_fkey FOREIGN KEY (source_id) REFERENCES public.metric_sources(id) ON DELETE CASCADE;


--
-- Name: metric_source_columns metric_source_columns_source_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metric_source_columns
    ADD CONSTRAINT metric_source_columns_source_fkey FOREIGN KEY (source_id) REFERENCES public.metric_sources(id) ON DELETE CASCADE;


--
-- Name: metrics metrics_source_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics
    ADD CONSTRAINT metrics_source_fkey FOREIGN KEY (source_id) REFERENCES public.metric_sources(id);


--
-- Name: resumes resumes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT resumes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: role_preferences role_preferences_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_preferences
    ADD CONSTRAINT role_preferences_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: role_preferences role_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_preferences
    ADD CONSTRAINT role_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: roles roles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: applications admin_all_applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_applications ON public.applications USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.email = (auth.jwt() ->> 'email'::text)) AND (users.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.email = (auth.jwt() ->> 'email'::text)) AND (users.role = 'admin'::text)))));


--
-- Name: companies admin_all_companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_companies ON public.companies USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.email = (auth.jwt() ->> 'email'::text)) AND (users.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.email = (auth.jwt() ->> 'email'::text)) AND (users.role = 'admin'::text)))));


--
-- Name: role_preferences admin_all_role_preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_role_preferences ON public.role_preferences USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.email = (auth.jwt() ->> 'email'::text)) AND (users.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.email = (auth.jwt() ->> 'email'::text)) AND (users.role = 'admin'::text)))));


--
-- Name: roles admin_all_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_roles ON public.roles USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.email = (auth.jwt() ->> 'email'::text)) AND (users.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.email = (auth.jwt() ->> 'email'::text)) AND (users.role = 'admin'::text)))));


--
-- Name: users admin_all_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_users ON public.users USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: job_opportunities admins manage opportunities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage opportunities" ON public.job_opportunities TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: job_personas admins manage personas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage personas" ON public.job_personas TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: learner_applications allow inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow inserts" ON public.learner_applications FOR INSERT WITH CHECK (true);


--
-- Name: mentor_applications allow inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow inserts" ON public.mentor_applications FOR INSERT WITH CHECK (true);


--
-- Name: alumni; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alumni ENABLE ROW LEVEL SECURITY;

--
-- Name: alumni_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alumni_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

--
-- Name: job_opportunities authenticated read opportunities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read opportunities" ON public.job_opportunities FOR SELECT TO authenticated USING (true);


--
-- Name: job_personas authenticated read personas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read personas" ON public.job_personas FOR SELECT TO authenticated USING (true);


--
-- Name: companies authenticated_read_companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_companies ON public.companies FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: roles authenticated_read_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_roles ON public.roles FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: case_triggers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.case_triggers ENABLE ROW LEVEL SECURITY;

--
-- Name: cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

--
-- Name: cohort_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cohort_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: alumni guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.alumni FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: alumni_jobs guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.alumni_jobs FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: applications guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.applications FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: cases guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.cases FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: companies guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.companies FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: job_opportunities guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.job_opportunities FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: job_personas guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.job_personas FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: learner_analysis guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.learner_analysis FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: learners guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.learners FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: metric_raw_rows guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.metric_raw_rows FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: metric_source_columns guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.metric_source_columns FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: metric_sources guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.metric_sources FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: metrics guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.metrics FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: resumes guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.resumes FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: role_preferences guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.role_preferences FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: roles guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.roles FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: settings guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.settings FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: sync_logs guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.sync_logs FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: users guest_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guest_read ON public.users FOR SELECT USING ((public.auth_role() = 'guest'::text));


--
-- Name: job_opportunities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_opportunities ENABLE ROW LEVEL SECURITY;

--
-- Name: job_personas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_personas ENABLE ROW LEVEL SECURITY;

--
-- Name: resumes learner_all_own_resumes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_all_own_resumes ON public.resumes USING ((user_id = public.current_user_id())) WITH CHECK ((user_id = public.current_user_id()));


--
-- Name: role_preferences learner_all_own_role_preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_all_own_role_preferences ON public.role_preferences USING ((user_id = public.current_user_id())) WITH CHECK ((user_id = public.current_user_id()));


--
-- Name: learner_analysis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learner_analysis ENABLE ROW LEVEL SECURITY;

--
-- Name: learner_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learner_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: applications learner_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_insert_own ON public.applications FOR INSERT WITH CHECK (((public.auth_role() = 'learner'::text) AND (user_id = auth.uid())));


--
-- Name: applications learner_insert_own_applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_insert_own_applications ON public.applications FOR INSERT WITH CHECK ((user_id = public.current_user_id()));


--
-- Name: learner_observations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learner_observations ENABLE ROW LEVEL SECURITY;

--
-- Name: learners learner_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_own ON public.learners FOR SELECT USING (((public.auth_role() = 'learner'::text) AND (user_id = auth.uid())));


--
-- Name: users learner_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_own ON public.users FOR SELECT USING (((public.auth_role() = 'learner'::text) AND (id = auth.uid())));


--
-- Name: companies learner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_read ON public.companies FOR SELECT USING ((public.auth_role() = 'learner'::text));


--
-- Name: roles learner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_read ON public.roles FOR SELECT USING ((public.auth_role() = 'learner'::text));


--
-- Name: applications learner_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_read_own ON public.applications FOR SELECT USING (((public.auth_role() = 'learner'::text) AND (user_id = auth.uid())));


--
-- Name: resumes learner_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_read_own ON public.resumes FOR SELECT USING (((public.auth_role() = 'learner'::text) AND (user_id = auth.uid())));


--
-- Name: role_preferences learner_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_read_own ON public.role_preferences FOR SELECT USING (((public.auth_role() = 'learner'::text) AND (user_id = auth.uid())));


--
-- Name: applications learner_read_own_applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_read_own_applications ON public.applications FOR SELECT USING ((user_id = public.current_user_id()));


--
-- Name: applications learner_update_own_applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_update_own_applications ON public.applications FOR UPDATE USING ((user_id = public.current_user_id()));


--
-- Name: resumes learner_write_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_write_own ON public.resumes USING (((public.auth_role() = 'learner'::text) AND (user_id = auth.uid())));


--
-- Name: role_preferences learner_write_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_write_own ON public.role_preferences USING (((public.auth_role() = 'learner'::text) AND (user_id = auth.uid())));


--
-- Name: learners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learners ENABLE ROW LEVEL SECURITY;

--
-- Name: mentor_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mentor_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: metric_raw_rows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metric_raw_rows ENABLE ROW LEVEL SECURITY;

--
-- Name: metric_source_columns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metric_source_columns ENABLE ROW LEVEL SECURITY;

--
-- Name: metric_sources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metric_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: prospects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

--
-- Name: resumes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

--
-- Name: role_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: users self_select_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY self_select_users ON public.users FOR SELECT USING ((email = (auth.jwt() ->> 'email'::text)));


--
-- Name: settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

--
-- Name: alumni staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.alumni USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: alumni_jobs staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.alumni_jobs USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: applications staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.applications USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: case_triggers staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.case_triggers USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: cases staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.cases USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: companies staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.companies USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: job_opportunities staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.job_opportunities USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: job_personas staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.job_personas USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: learner_analysis staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.learner_analysis USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: learner_observations staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.learner_observations USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: learners staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.learners USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: metric_raw_rows staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.metric_raw_rows USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: metric_source_columns staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.metric_source_columns USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: metric_sources staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.metric_sources USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: metrics staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.metrics USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: prospects staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.prospects USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: resumes staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.resumes USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: role_preferences staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.role_preferences USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: roles staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.roles USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: settings staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.settings USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: sync_logs staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.sync_logs USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: users staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all ON public.users USING ((public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: sync_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict w1vm2qcebxdfsMglVRB2tbLXUgPbB7iceHz0iSoIWwjdbYwlJOBqV1oI4fGBOiC

