-- Add entry_level_only flag to job_personas
ALTER TABLE job_personas ADD COLUMN IF NOT EXISTS entry_level_only boolean DEFAULT false;
