-- 061: Add a 'placed_elsewhere' application status.
--
-- Used when a learner in an active process gets placed through another route and
-- must drop out of this one. It's a terminal drop-off (like not_shortlisted /
-- rejected) — it does NOT count as one of our placements ('hired').

ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE public.applications ADD CONSTRAINT applications_status_check
  CHECK (status = ANY (ARRAY[
    'applied'::text,
    'shortlisted'::text,
    'interviews_ongoing'::text,
    'on_hold'::text,
    'not_shortlisted'::text,
    'rejected'::text,
    'hired'::text,
    'placed_elsewhere'::text
  ]));
