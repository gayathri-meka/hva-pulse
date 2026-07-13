-- 071: Challenge review — cohort challenge end date (the "finished" backstop).
--
-- A candidate is evaluated (Select/Review/Reject) only once they've FINISHED the
-- 14-day challenge: 14 days elapsed since their first activity, OR this cohort end
-- date has passed. Before that they're 'in_progress' and no rules gate — so no one
-- mid-challenge gets a system reject. NULL = not set (only the per-candidate 14-day
-- window applies; never-started learners stay 'in_progress' until it's set).

ALTER TABLE public.challenge_review_config
  ADD COLUMN IF NOT EXISTS challenge_end_date date;
