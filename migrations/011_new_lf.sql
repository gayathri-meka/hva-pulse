-- Add new_lf column to learners table (from "New LF" column in Learner Info sheet)
ALTER TABLE learners ADD COLUMN IF NOT EXISTS new_lf TEXT;
