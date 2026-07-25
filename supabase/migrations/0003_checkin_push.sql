-- FluidSense check-in reminders: per-profile timezone, push subscriptions,
-- and the hourly cron job that invokes the `send-checkin-reminders` Edge
-- Function. Run alongside 0001_init.sql and 0002_drink_photos.sql via the
-- Supabase CLI: `supabase db push`.
--
-- ============================================================================
-- OPERATOR ACTION REQUIRED BEFORE THIS MIGRATION GOES LIVE
-- ============================================================================
-- 1. Extensions (`pg_cron`, `pg_net`) require elevated privileges that are not
--    guaranteed in every Supabase project/plan. If the `create extension`
--    statements below fail when this migration is applied, enable both
--    extensions manually first via the Supabase dashboard
--    (Database -> Extensions), then re-run the migration.
-- 2. The `cron.schedule(...)` call at the bottom of this file is a TEMPLATE.
--    It contains two placeholders — 'REPLACE_WITH_PROJECT_URL' and
--    'REPLACE_WITH_CRON_SECRET' — that will error obviously if applied
--    unedited. Before applying this migration, replace them with:
--      - your project's Functions URL, e.g.
--        'https://<project-ref>.supabase.co/functions/v1/send-checkin-reminders'
--      - the same secret value you set on the Edge Function via
--        `supabase secrets set CRON_SECRET=...`
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Profiles: add an optional IANA timezone string, used to compute each
-- patient's local check-in windows. Null is treated as 'UTC' by application
-- code (the Edge Function below and any client-side display logic).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists timezone text;

-- ---------------------------------------------------------------------------
-- Push subscriptions: Web Push (VAPID) endpoints registered by a patient's
-- browser, used to deliver check-in reminders. One profile may have several
-- (e.g. multiple devices).
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "owners can manage their push subscriptions" on public.push_subscriptions
  for all using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Required extensions for scheduling and calling the reminder Edge Function
-- from the database. See the operator note at the top of this file — these
-- statements may need to be run via the dashboard instead on some plans.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Hourly cron job: calls the send-checkin-reminders Edge Function on the
-- hour, every hour. The function itself determines, per profile, whether the
-- patient's current local hour falls inside a check-in window and whether a
-- reminder is actually still needed.
--
-- TEMPLATE — replace both placeholders below before applying, see the
-- operator note at the top of this file.
-- ---------------------------------------------------------------------------
select cron.schedule(
  'checkin-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'REPLACE_WITH_PROJECT_URL/functions/v1/send-checkin-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'REPLACE_WITH_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
