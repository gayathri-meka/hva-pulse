-- 086: Tech Support tickets in Postgres (shared with the hva-automation Slack edge).
--
-- Background: Tech Support tickets are raised via the /tech-support Slack flow, handled by the
-- `hva-slack-router` edge function in the hva-automation repo. That edge function and this app
-- share ONE Supabase project, so the edge (service-role) writes tickets straight into these
-- tables and hva-pulse reads/acts on them. Postgres is the single source of truth; the old
-- Google Sheet + Apps Script store is retired.
--
-- Tables:
--   tickets           — one row per ticket, natural key `ticket_id` (the Slack modal/view id).
--   ticket_events     — audit log of status/field changes (who did what, from -> to), so Pulse-side
--                       actions are traceable. Reply BODIES are NOT stored (they live in the Slack
--                       thread); only the fact that a reply happened is logged here.
--   ticket_categories — dynamic category list + SPOC assignment (read by the edge + Pulse).
--
-- RLS mirrors the 046_prospects.sql pattern: staff/admin only. The edge uses the service-role key
-- (bypasses RLS); hva-pulse reads/writes with the user session (RLS -> admin/staff).

-- ── tickets ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tickets (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  ticket_id         text        NOT NULL UNIQUE,          -- Slack view id, e.g. "V0BL2FTJDT9" — natural key
  category          text        NOT NULL,
  priority          text        NOT NULL,                 -- Low / Medium / High
  title             text        NOT NULL,
  description       text,
  raiser_slack_id   text,
  raiser_name       text,
  raiser_email      text,
  spocs             text[]      NOT NULL DEFAULT '{}',    -- assigned SPOC Slack user ids (for @-tagging)
  spoc_emails       text[]      NOT NULL DEFAULT '{}',    -- SPOC emails (the identity bridge for Pulse gating)
  status            text        NOT NULL DEFAULT 'open',  -- open / closed / escalated
  channel_id        text,                                 -- Slack channel the card lives in (main or test)
  channel_ts        text,                                 -- channel card root ts (also the reminder thread root)
  dm_ts             text,                                 -- requester DM card root ts
  dm_channel_id     text,                                 -- requester DM channel id
  attachment_url    text,                                 -- Slack permalink (nullable)
  is_test           boolean     NOT NULL DEFAULT false,
  reminder_count    int         NOT NULL DEFAULT 0,       -- maintained by the reminder cron
  escalated         boolean     NOT NULL DEFAULT false,   -- maintained by the reminder cron
  last_reminded_at  timestamptz,                          -- maintained by the reminder cron
  reminders_muted   boolean     NOT NULL DEFAULT false,   -- replaces the Sheet's MUTE/SKIP sentinel
  closed_by_email   text,                                 -- who closed (Slack closer email OR pulse actor email)
  closed_by         uuid        REFERENCES public.users(id) ON DELETE SET NULL, -- set only when closed from hva-pulse
  closed_at         timestamptz,
  rating            int,                                  -- requester CSAT after close: 1 (bad) / 2 (okay) / 3 (great)
  feedback          text,                                 -- optional free-text comment from the requester
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),   -- bump on every write
  CONSTRAINT tickets_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS tickets_status_idx      ON public.tickets (status);
CREATE INDEX IF NOT EXISTS tickets_created_at_idx  ON public.tickets (created_at DESC);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_all ON public.tickets;
CREATE POLICY staff_all ON public.tickets
  FOR ALL USING (public.auth_role() IN ('admin', 'staff'));

-- ── ticket_events (audit log) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ticket_events (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  ticket_id     text        NOT NULL REFERENCES public.tickets(ticket_id) ON DELETE CASCADE,
  action        text        NOT NULL,                     -- close / reopen / edit / reply / reminder / escalate
  actor_email   text,                                     -- who did it (pulse actor OR slack closer email)
  actor_source  text        NOT NULL DEFAULT 'pulse',     -- pulse / slack / cron
  details       jsonb,                                    -- e.g. { "priority": {"from":"Low","to":"High"} }
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_events_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ticket_events_ticket_idx ON public.ticket_events (ticket_id, created_at);

ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_all ON public.ticket_events;
CREATE POLICY staff_all ON public.ticket_events
  FOR ALL USING (public.auth_role() IN ('admin', 'staff'));

-- ── ticket_categories (dynamic category list + SPOC assignment) ──────────────────
-- Replaces the hardcoded CATEGORIES / CATEGORY_SPOCS in the edge. The edge reads this when building
-- the New Ticket Slack modal and assigning SPOCs; Pulse reads it for the category picker and the
-- edit modal. Adding/renaming a category or changing its SPOC is a data edit — no redeploy.
--
-- SPOCs are the app's admin/staff USERS (public.users): a category's `spoc_emails` are user emails.
-- Email is the source of truth (it drives Pulse permission gating directly); the Slack user id for
-- @-tagging is resolved at runtime from the email via Slack users.lookupByEmail. So there is no
-- separate SPOC roster table and no Slack ids stored here.
CREATE TABLE IF NOT EXISTS public.ticket_categories (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  spoc_emails text[]      NOT NULL DEFAULT '{}',          -- emails of assigned admin/staff users
  sort_order  int         NOT NULL DEFAULT 0,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_categories_pkey PRIMARY KEY (id)
);

-- Seeded with empty SPOC assignments — assign SPOCs (pick admin/staff users) from the Pulse
-- "Manage categories" screen after applying.
INSERT INTO public.ticket_categories (name, sort_order) VALUES
  ('Program Related',      1),
  ('14 Day Challenge',     2),
  ('SensAI',               3),
  ('Motivation Interview', 4),
  ('Coding Interview',     5)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_all ON public.ticket_categories;
CREATE POLICY staff_all ON public.ticket_categories
  FOR ALL USING (public.auth_role() IN ('admin', 'staff'));
