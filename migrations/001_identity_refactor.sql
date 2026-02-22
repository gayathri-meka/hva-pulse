-- ============================================================
-- Migration 001: Identity Refactor
--
-- Goals:
--   • users becomes the single identity source (id, email, name, role, created_at)
--   • learners becomes a domain extension (user_id PK, lf_user_id, domain fields only)
--   • lfs data migrated into users (role = 'LF'); lfs table left intact but unused
--   • 128 learners + 4 LFs inserted into users
--   • applications.learner_id (text) is untouched — no formal FK, domain lookup only
--
-- HOW TO RUN:
--   Paste this entire file into the Supabase SQL Editor and click Run.
--   It is wrapped in a transaction: all steps succeed or none do.
--
-- VERIFY AFTER RUNNING:
--   SELECT role, count(*) FROM users GROUP BY role;
--   SELECT count(*) FROM learners WHERE user_id IS NULL;  -- must be 0
--   SELECT count(*) FROM learners;                        -- must still be 128
--
-- ROLLBACK GUIDANCE (at the bottom of this file)
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: Expand the users table
--   Add: id (uuid PK), name (text), created_at (timestamptz)
--   Migrate role value 'lf' → 'LF'
--   Expand role check to include 'LF' and 'learner'
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS name       text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Promote id to primary key (drops existing PK on email if present)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE public.users ADD PRIMARY KEY (id);

-- Keep email as a unique identifier
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass AND conname = 'users_email_unique'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;

-- Expand role check: migrate 'lf' → 'LF' first, then add new values
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE public.users SET role = 'LF' WHERE role = 'lf';
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'LF', 'learner'));


-- ============================================================
-- STEP 2: Insert LFs into users (skip if email already present)
-- ============================================================

INSERT INTO public.users (email, name, role)
SELECT lf.email, lf.name, 'LF'
FROM public.lfs lf
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.email = lf.email
);


-- ============================================================
-- STEP 3: Insert all 128 learners into users
-- ============================================================

INSERT INTO public.users (email, name, role)
SELECT l.email, l.name, 'learner'
FROM public.learners l
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.email = l.email
);


-- ============================================================
-- STEP 4: Add user_id and lf_user_id to learners, populate them
-- ============================================================

ALTER TABLE public.learners
  ADD COLUMN IF NOT EXISTS user_id    uuid,
  ADD COLUMN IF NOT EXISTS lf_user_id uuid;

-- Populate user_id by matching learner email → users.id
UPDATE public.learners l
SET user_id = u.id
FROM public.users u
WHERE u.email = l.email;

-- Populate lf_user_id via lfs bridge: lf_id → lfs.email → users.id
UPDATE public.learners l
SET lf_user_id = u.id
FROM public.lfs lf
JOIN public.users u ON u.email = lf.email
WHERE lf.id = l.lf_id;


-- ============================================================
-- STEP 5: Restructure learners table
--   • user_id becomes the primary key
--   • learner_id stays as a UNIQUE domain key (used by applications table)
--   • Drop name, email, lf_id (identity now lives in users)
--   • Add FK constraints
-- ============================================================

-- Enforce user_id is populated (should be 0 nulls at this point)
ALTER TABLE public.learners ALTER COLUMN user_id SET NOT NULL;

-- Swap PK from learner_id → user_id
ALTER TABLE public.learners DROP CONSTRAINT IF EXISTS learners_pkey;
ALTER TABLE public.learners ADD PRIMARY KEY (user_id);

-- learner_id stays unique (applications.learner_id references it as a text lookup)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.learners'::regclass AND conname = 'learners_learner_id_unique'
  ) THEN
    ALTER TABLE public.learners ADD CONSTRAINT learners_learner_id_unique UNIQUE (learner_id);
  END IF;
END $$;

-- Foreign key: learners.user_id → users.id (cascade delete)
ALTER TABLE public.learners
  ADD CONSTRAINT learners_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Foreign key: learners.lf_user_id → users.id (null out if LF deleted)
ALTER TABLE public.learners
  ADD CONSTRAINT learners_lf_user_id_fkey
    FOREIGN KEY (lf_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Drop identity columns that moved to users
ALTER TABLE public.learners
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS lf_id;


-- ============================================================
-- STEP 6: RLS on users table
--
-- Notes:
--   • self_select_users: lets getAppUser() read the current user's own row
--   • admin_all_users: full access for admins, using a SECURITY DEFINER
--     function to avoid infinite recursion (policy → sub-query → same table)
--   • The existing policies on companies/roles/applications sub-query users
--     with `email = auth.jwt()->>'email'`; the self_select policy satisfies
--     that filter so those policies continue to work correctly.
-- ============================================================

-- SECURITY DEFINER function avoids recursive RLS evaluation
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE email = auth.jwt()->>'email' AND role = 'admin'
  );
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Each user can read their own row
CREATE POLICY "self_select_users" ON public.users
  FOR SELECT
  USING (email = auth.jwt()->>'email');

-- Admins can do everything
CREATE POLICY "admin_all_users" ON public.users
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


COMMIT;


-- ============================================================
-- ROLLBACK STEPS (manual — only if you need to undo this)
-- ============================================================
--
-- Run in order in the SQL Editor:
--
-- BEGIN;
--
-- -- 1. Re-add identity columns to learners
-- ALTER TABLE public.learners
--   ADD COLUMN name  text,
--   ADD COLUMN email text,
--   ADD COLUMN lf_id integer;
--
-- -- 2. Repopulate from users and lfs
-- UPDATE public.learners l
--   SET name  = u.name,
--       email = u.email
--   FROM public.users u WHERE u.id = l.user_id;
--
-- UPDATE public.learners l
--   SET lf_id = lf.id
--   FROM public.lfs lf
--   JOIN public.users u ON u.email = lf.email
--   WHERE u.id = l.lf_user_id;
--
-- -- 3. Drop new columns and constraints
-- ALTER TABLE public.learners
--   DROP CONSTRAINT IF EXISTS learners_user_id_fkey,
--   DROP CONSTRAINT IF EXISTS learners_lf_user_id_fkey,
--   DROP CONSTRAINT IF EXISTS learners_learner_id_unique,
--   DROP CONSTRAINT IF EXISTS learners_pkey;
-- ALTER TABLE public.learners
--   DROP COLUMN IF EXISTS user_id,
--   DROP COLUMN IF EXISTS lf_user_id;
-- ALTER TABLE public.learners ADD PRIMARY KEY (learner_id);
--
-- -- 4. Remove learner and LF rows from users; restore role constraint
-- DELETE FROM public.users WHERE role IN ('learner', 'LF') AND email IN (
--   SELECT email FROM public.learners
-- );
-- -- (delete remaining LF rows added from lfs table)
-- DELETE FROM public.users WHERE role = 'LF';
--
-- UPDATE public.users SET role = 'lf' WHERE role = 'LF';
-- ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
-- ALTER TABLE public.users
--   ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'lf'));
--
-- -- 5. Restore users table structure (drop id, name, created_at; restore email PK)
-- ALTER TABLE public.users
--   DROP CONSTRAINT IF EXISTS users_email_unique,
--   DROP CONSTRAINT IF EXISTS users_pkey;
-- ALTER TABLE public.users
--   DROP COLUMN IF EXISTS id,
--   DROP COLUMN IF EXISTS name,
--   DROP COLUMN IF EXISTS created_at;
-- ALTER TABLE public.users ADD PRIMARY KEY (email);
--
-- -- 6. Disable RLS and drop policies on users
-- DROP POLICY IF EXISTS "self_select_users" ON public.users;
-- DROP POLICY IF EXISTS "admin_all_users" ON public.users;
-- ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
-- DROP FUNCTION IF EXISTS public.is_admin();
--
-- COMMIT;
