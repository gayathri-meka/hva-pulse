-- Rename fy_year → cohort_fy on both tables
ALTER TABLE public.learners RENAME COLUMN fy_year TO cohort_fy;
ALTER TABLE public.alumni   RENAME COLUMN fy_year TO cohort_fy;

-- Add placed_fy (the FY year the person was actually placed)
ALTER TABLE public.learners ADD COLUMN IF NOT EXISTS placed_fy text;
ALTER TABLE public.alumni   ADD COLUMN IF NOT EXISTS placed_fy text;
