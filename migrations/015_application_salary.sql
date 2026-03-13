-- Salary captured at hire time (populates alumni_jobs automatically)
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS salary_lpa numeric;
