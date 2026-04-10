-- Add BigQuery as a second metric source type alongside Google Sheets.
--
-- Existing sources default to 'sheet'. BigQuery sources store a fully-
-- qualified view reference (project.dataset.table) and use the billing
-- project for job execution.
--
-- The existing metric_source_columns table (learner_id / value / dimension
-- roles) works identically for both source types.

ALTER TABLE public.metric_sources
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'sheet'
    CHECK (source_type IN ('sheet', 'bigquery'));

-- BigQuery connection fields (nullable; only set when source_type = 'bigquery')
ALTER TABLE public.metric_sources
  ADD COLUMN IF NOT EXISTS bq_project text,
  ADD COLUMN IF NOT EXISTS bq_dataset text,
  ADD COLUMN IF NOT EXISTS bq_table   text,
  ADD COLUMN IF NOT EXISTS bq_filter  text;  -- optional SQL WHERE clause, e.g. "course_id IN (301,319)"

-- Make sheet_id / sheet_tab nullable so BigQuery sources can leave them empty
ALTER TABLE public.metric_sources
  ALTER COLUMN sheet_id  DROP NOT NULL,
  ALTER COLUMN sheet_tab DROP NOT NULL;

-- Enforce: sheet sources need sheet fields; BQ sources need BQ fields
ALTER TABLE public.metric_sources
  ADD CONSTRAINT metric_sources_type_fields_chk CHECK (
    (source_type = 'sheet'    AND sheet_id IS NOT NULL AND sheet_tab IS NOT NULL)
    OR
    (source_type = 'bigquery' AND bq_project IS NOT NULL AND bq_dataset IS NOT NULL AND bq_table IS NOT NULL)
  );
