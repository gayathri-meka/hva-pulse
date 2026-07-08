-- 062: OAuth credentials for the shared Google email-sending account.
--
-- Campaigns send via the Gmail API using ONE shared connected Google account
-- (e.g. admissions@…). An admin connects it once via OAuth; we keep the refresh
-- token here and mint short-lived access tokens per send. `provider` is UNIQUE, so
-- there is exactly one shared credential row per provider.
--
-- refresh_token is sensitive — this table is service-role/admin only (RLS below).

CREATE TABLE IF NOT EXISTS public.email_oauth_credentials (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          text NOT NULL DEFAULT 'google',
  email             text NOT NULL,                 -- the connected sending account
  refresh_token     text NOT NULL,
  access_token      text,                          -- cached; refreshed when expired
  token_expiry      timestamptz,
  connected_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  connected_by_name text,
  connected_at      timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider)
);

ALTER TABLE public.email_oauth_credentials ENABLE ROW LEVEL SECURITY;

-- Admin/staff only; app access goes through the service-role client (bypasses RLS).
DROP POLICY IF EXISTS staff_all ON public.email_oauth_credentials;
CREATE POLICY staff_all ON public.email_oauth_credentials
  USING (public.auth_role() = ANY (ARRAY['admin'::text, 'staff'::text]));
