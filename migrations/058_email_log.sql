-- 058: Audit log for outbound emails (templated mail-merge campaigns).
-- One row per recipient per send, so we have a record of who was emailed, when,
-- by whom, and whether it succeeded. Useful for audit and to spot accidental
-- double-sends. Admin-only.

CREATE TABLE IF NOT EXISTS public.email_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient   text NOT NULL,                                   -- normalised (lower/trim)
  subject     text NOT NULL,                                   -- rendered subject
  campaign    text,                                            -- optional source/label
  status      text NOT NULL,                                   -- 'sent' | 'failed'
  error       text,
  provider_id text,                                            -- Resend message id
  sent_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_log_recipient_idx  ON public.email_log (recipient);
CREATE INDEX IF NOT EXISTS email_log_created_at_idx ON public.email_log (created_at DESC);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Admin-only. App reads/writes go through the service-role client (bypasses RLS).
DROP POLICY IF EXISTS admin_all ON public.email_log;
CREATE POLICY admin_all ON public.email_log
  USING (public.auth_role() = 'admin'::text);
