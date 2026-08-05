-- Editable Coding Interviews tracker. Eligibility continues to come from the
-- Personal Interview outcome; this table stores only coding-round operational data.
CREATE TABLE IF NOT EXISTS public.coding_interview_reviews (
  candidate_email                    text PRIMARY KEY,
  interview_status                   text NOT NULL DEFAULT 'not_started'
    CHECK (interview_status IN ('not_started', 'completed')),
  verdict                            text CHECK (verdict IN ('selected', 'rejected')),
  interview_date                     date,
  interview_time                     time,
  pre_interview_notes                text,
  interviewer                        text CHECK (interviewer IN ('Jija', 'Anuj', 'Manisha', 'Gyan')),
  problems_asked                     text,
  coding_score                       numeric CHECK (coding_score IN (1, 2, 2.5, 3, 3.5, 4)),
  reading_comprehension_score        numeric CHECK (reading_comprehension_score IN (1, 2, 2.5, 3, 3.5, 4)),
  learnability_observations          text,
  notes                              text,
  summary                            text,
  updated_at                         timestamptz NOT NULL DEFAULT now(),
  updated_by                         text
);

ALTER TABLE public.coding_interview_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_all ON public.coding_interview_reviews;
CREATE POLICY staff_all ON public.coding_interview_reviews
  USING (public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text]));
