-- Learning module: metric engine + intervention cases

-- ── Metric engine ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.metric_sources (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  sheet_id       text        NOT NULL,
  sheet_tab      text        NOT NULL,
  last_synced_at timestamptz,
  row_count      integer,
  sync_error     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metric_sources_pkey PRIMARY KEY (id)
);

-- One row per column detected in the source sheet.
-- role: learner_id = the email column, value = the thing being measured,
--       dimension = a filter column (given a friendly label), ignored = skip.
CREATE TABLE IF NOT EXISTS public.metric_source_columns (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  source_id   uuid NOT NULL,
  column_name text NOT NULL,   -- raw name as it appears in the sheet
  role        text NOT NULL CHECK (role IN ('learner_id', 'value', 'dimension', 'ignored')),
  label       text,            -- friendly name shown in UI (dimensions only)
  CONSTRAINT metric_source_columns_pkey        PRIMARY KEY (id),
  CONSTRAINT metric_source_columns_unique      UNIQUE (source_id, column_name),
  CONSTRAINT metric_source_columns_source_fkey FOREIGN KEY (source_id)
    REFERENCES public.metric_sources(id) ON DELETE CASCADE
);

-- Normalized long-format rows synced from the sheet.
-- dimensions: {"session_type": "english", "week": "week1"} — only dimension-role columns.
-- value: raw cell value (text); null if cell was empty.
-- Full replace on every sync: delete all rows for source_id, then bulk insert.
CREATE TABLE IF NOT EXISTS public.metric_raw_rows (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  source_id  uuid        NOT NULL,
  learner_id text        NOT NULL,
  dimensions jsonb       NOT NULL DEFAULT '{}',
  value      text,
  CONSTRAINT metric_raw_rows_pkey        PRIMARY KEY (id),
  CONSTRAINT metric_raw_rows_source_fkey FOREIGN KEY (source_id)
    REFERENCES public.metric_sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metric_raw_rows_source_learner ON public.metric_raw_rows(source_id, learner_id);
CREATE INDEX IF NOT EXISTS idx_metric_raw_rows_dimensions     ON public.metric_raw_rows USING gin(dimensions);

-- Simple metric definitions: an aggregation over a source with optional filters.
-- filters: [{"column": "session_type", "operator": "eq", "value": "english"}]
--   column stores the raw column_name; UI resolves to label via metric_source_columns.
-- description: plain-English summary generated on save using friendly labels,
--   e.g. "COUNT where Session type = english". Regenerated if a column label changes.
-- aggregation COUNT works for any value type; SUM/AVG/MIN/MAX require numeric values.
CREATE TABLE IF NOT EXISTS public.metrics (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  source_id   uuid        NOT NULL,
  aggregation text        NOT NULL CHECK (aggregation IN ('COUNT', 'SUM', 'AVG', 'MIN', 'MAX')),
  filters     jsonb       NOT NULL DEFAULT '[]',
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metrics_pkey        PRIMARY KEY (id),
  CONSTRAINT metrics_name_key    UNIQUE (name),
  CONSTRAINT metrics_source_fkey FOREIGN KEY (source_id)
    REFERENCES public.metric_sources(id)
);

-- ── Intervention cases ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.learning_case_categories (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  label      text        NOT NULL,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_case_categories_pkey      PRIMARY KEY (id),
  CONSTRAINT learning_case_categories_label_key UNIQUE (label)
);

INSERT INTO public.learning_case_categories (label, sort_order) VALUES
  ('Life circumstance',       1),
  ('Content difficulty',      2),
  ('Motivation / confidence', 3),
  ('External commitments',    4),
  ('Other',                   5)
ON CONFLICT (label) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.learning_cases (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  learner_id    text        NOT NULL,
  opened_by     uuid,
  status        text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),

  -- Step 1: Root cause
  root_cause_category_id uuid,
  root_cause_notes       text,
  step1_completed_at     timestamptz,

  -- Step 2: Action plan
  action_plan_steps    jsonb       NOT NULL DEFAULT '[]',
  action_plan_notes    text,
  action_plan_owner    uuid,
  action_plan_due_date date,
  step2_completed_at   timestamptz,

  -- Step 3: Monitor
  resurface_date   date,
  last_reviewed_at timestamptz,

  -- Close
  outcome      text CHECK (outcome IN ('resolved', 'dropped', 'other')),
  outcome_note text,
  closed_at    timestamptz,
  closed_by    uuid,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT learning_cases_pkey         PRIMARY KEY (id),
  CONSTRAINT learning_cases_learner_fkey FOREIGN KEY (learner_id)             REFERENCES public.learners(learner_id) ON DELETE CASCADE,
  CONSTRAINT learning_cases_opener_fkey  FOREIGN KEY (opened_by)              REFERENCES public.users(id),
  CONSTRAINT learning_cases_cat_fkey     FOREIGN KEY (root_cause_category_id) REFERENCES public.learning_case_categories(id),
  CONSTRAINT learning_cases_owner_fkey   FOREIGN KEY (action_plan_owner)      REFERENCES public.users(id),
  CONSTRAINT learning_cases_closer_fkey  FOREIGN KEY (closed_by)              REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_learning_cases_learner_status ON public.learning_cases(learner_id, status);
CREATE INDEX IF NOT EXISTS idx_learning_cases_resurface      ON public.learning_cases(resurface_date) WHERE status = 'open';
