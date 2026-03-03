-- Add structured reasons array for not_shortlisted status
-- not_shortlisted_reason is repurposed as "additional comments" (optional free text)
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS not_shortlisted_reasons TEXT[] DEFAULT '{}';
