-- Editable internal comments for every challenge candidate, including rows that
-- do not yet have a verified decision.
CREATE TABLE IF NOT EXISTS public.challenge_review_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  cohort_id integer NOT NULL,
  course_id integer NOT NULL,
  note text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, cohort_id, course_id)
);

ALTER TABLE public.challenge_review_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_all ON public.challenge_review_notes;
CREATE POLICY staff_all ON public.challenge_review_notes
  USING (public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text]));
