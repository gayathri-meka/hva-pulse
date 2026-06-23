-- 057: Email-keyed comment threads for admissions (Website hits + Prospects).
--
-- Comments are keyed by NORMALISED email (lower(trim(email))) so the same person
-- shows the same thread across both the learner_applications ("Website hits") and
-- prospects tabs. Append-only log: each row is one team member's note, attributed
-- (author_id + denormalised author_name snapshot) and timestamped. The team uses
-- these for context like "struggled to sign in to SensAI for xyz reason".

CREATE TABLE IF NOT EXISTS public.prospect_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,                                   -- normalised: lower(trim(email))
  body        text NOT NULL,
  author_id   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  author_name text,                                            -- snapshot for display
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Every read is "all comments for this email", so index it.
CREATE INDEX IF NOT EXISTS prospect_comments_email_idx
  ON public.prospect_comments (email);

ALTER TABLE public.prospect_comments ENABLE ROW LEVEL SECURITY;

-- Same access rule as prospects: admin/staff can do everything. App reads/writes
-- go through the service-role client (bypasses RLS); this policy is the backstop.
DROP POLICY IF EXISTS staff_all ON public.prospect_comments;
CREATE POLICY staff_all ON public.prospect_comments
  USING (public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text]));
