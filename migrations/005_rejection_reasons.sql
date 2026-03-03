ALTER TABLE applications ADD COLUMN IF NOT EXISTS rejection_reasons TEXT[] DEFAULT '{}';
