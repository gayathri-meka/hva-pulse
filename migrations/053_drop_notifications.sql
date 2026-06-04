-- 053: Drop the notifications table. The original implementation was a
-- never-inserted-into table with a synthesized-on-render bell that nothing
-- meaningful flowed through. The team will design a new solution; the
-- existing schema isn't worth keeping in the meantime.

DROP TABLE IF EXISTS public.notifications;
