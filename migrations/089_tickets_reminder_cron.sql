-- 089: Tech Support cron jobs — daily reminders + weekly Monday summary.
--
-- Replaces the old Google Apps Script triggers. pg_cron jobs POST to the shared edge function
-- (hva-automation `hva-slack-router`) with { source:'cron', kind, secret }:
--   • kind='run_reminders'      — daily (Mon–Fri), posts due reminders into ticket threads +
--                                 escalates after 3 reminders.
--   • kind='run_weekly_summary' — Monday, posts a per-SPOC weekly summary to the main channel.
--
-- Schedule: 04:30 UTC = 10:00 AM IST, WEEKDAYS ONLY (Mon–Fri) — no weekend nags. Since 04:30 UTC is
-- the same calendar day as 10:00 IST, the `1-5` day-of-week filter maps cleanly to Mon–Fri IST.
--
-- ── One-time setup (run by a project Owner/Admin — needs the extensions + Vault) ────────────────
--   1. Enable extensions (idempotent):
--        create extension if not exists pg_cron;
--        create extension if not exists pg_net;
--   2. Store the edge URL + the shared secret in Vault (replace <SECRET> with the value also set as
--      the edge's HVA_PULSE_EDGE_SECRET). Run once:
--        select vault.create_secret(
--          'https://onukununwlcwowtgqzxl.supabase.co/functions/v1/hva-slack-router',
--          'hva_slack_router_url');
--        select vault.create_secret('<SECRET>', 'hva_pulse_edge_secret');
--      (To rotate later: select vault.update_secret((select id from vault.secrets where name='hva_pulse_edge_secret'), '<NEW>');)
--   3. Then run the schedule block below.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent (re)schedule.
select cron.unschedule('techsupport-daily-reminders')
where exists (select 1 from cron.job where jobname = 'techsupport-daily-reminders');

select cron.schedule(
  'techsupport-daily-reminders',
  '30 4 * * 1-5',  -- 04:30 UTC = 10:00 AM IST, Mon–Fri only (1=Mon … 5=Fri; weekends skipped)
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'hva_slack_router_url'),
    headers := '{"content-type":"application/json"}'::jsonb,
    body    := jsonb_build_object(
                 'source', 'cron',
                 'kind',   'run_reminders',
                 'secret', (select decrypted_secret from vault.decrypted_secrets where name = 'hva_pulse_edge_secret')
               )
  );
  $$
);

-- Weekly summary — Monday 09:00 IST = 03:30 UTC Monday (1 = Monday).
select cron.unschedule('techsupport-weekly-summary')
where exists (select 1 from cron.job where jobname = 'techsupport-weekly-summary');

select cron.schedule(
  'techsupport-weekly-summary',
  '30 3 * * 1',  -- 03:30 UTC = 09:00 AM IST every Monday
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'hva_slack_router_url'),
    headers := '{"content-type":"application/json"}'::jsonb,
    body    := jsonb_build_object(
                 'source', 'cron',
                 'kind',   'run_weekly_summary',
                 'secret', (select decrypted_secret from vault.decrypted_secrets where name = 'hva_pulse_edge_secret')
               )
  );
  $$
);
