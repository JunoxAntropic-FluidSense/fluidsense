-- FluidSense initial schema.
-- Run via the Supabase CLI: `supabase db push` (or applied automatically on
-- `supabase start` for local dev). Every table is scoped to the owning user
-- through row-level security so one account can never read another's data.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Users: one row per authenticated account, keyed to auth.users.
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role text not null default 'patient'
    check (role in ('patient', 'family_carer', 'nurse', 'healthcare_assistant', 'clinician')),
  mode text not null default 'patient' check (mode in ('patient', 'healthcare')),
  timezone text not null default 'UTC',
  preferred_units text not null default 'mL' check (preferred_units in ('mL', 'L')),
  onboarding_completed boolean not null default false,
  save_voice_transcripts boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users can read their own row" on public.users
  for select using (auth.uid() = id);
create policy "users can update their own row" on public.users
  for update using (auth.uid() = id);
create policy "users can insert their own row" on public.users
  for insert with check (auth.uid() = id);
create policy "users can delete their own row" on public.users
  for delete using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Profiles: the person being monitored — the account holder themselves in
-- patient mode, or one row per patient under a healthcare account.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  display_name text not null,
  care_setting text not null default '',
  monitoring_reason text,
  units text not null default 'mL' check (units in ('mL', 'L')),
  monitoring_day_start_mode text not null default 'midnight'
    check (monitoring_day_start_mode in ('midnight', 'custom_time', 'on_demand')),
  monitoring_day_custom_hour smallint check (monitoring_day_custom_hour between 0 and 23),
  active_monitoring_period_id uuid, -- FK added below, once monitoring_periods exists
  daily_allowance_ml numeric,
  allowance_set_by_name text,
  allowance_set_by_role text,
  allowance_set_at timestamptz,
  daily_weight_enabled boolean not null default false,
  contact_instructions text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "owners can manage their profiles" on public.profiles
  for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

-- ---------------------------------------------------------------------------
-- Monitoring periods: "Start new day" boundaries.
-- ---------------------------------------------------------------------------
create table if not exists public.monitoring_periods (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  start_time timestamptz not null default now(),
  end_time timestamptz,
  type text not null default 'manual' check (type in ('calendar_day', 'custom_shift', 'rolling_24h', 'manual')),
  status text not null default 'active' check (status in ('active', 'closed')),
  created_by text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_active_monitoring_period_fk
  foreign key (active_monitoring_period_id) references public.monitoring_periods (id) on delete set null;

alter table public.monitoring_periods enable row level security;

create policy "owners can manage monitoring periods" on public.monitoring_periods
  for all using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Containers and saved fluids ("My drinks" / "Patient fluid library").
-- ---------------------------------------------------------------------------
create table if not exists public.containers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  volume_ml numeric not null,
  is_standard boolean not null default false,
  favourite boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_fluids (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  brand text,
  category text not null,
  container_id uuid references public.containers (id) on delete set null,
  container_volume_ml numeric,
  usual_serving_fraction numeric,
  water_content_percent numeric,
  water_content_source text,
  verified boolean not null default false,
  favourite boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.containers enable row level security;
alter table public.saved_fluids enable row level security;

create policy "owners can manage their containers" on public.containers
  for all using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())
  );

create policy "owners can manage their saved fluids" on public.saved_fluids
  for all using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Fluid events: the core intake/output log.
-- ---------------------------------------------------------------------------
create table if not exists public.fluid_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  monitoring_period_id uuid references public.monitoring_periods (id) on delete set null,
  direction text not null check (direction in ('intake', 'output')),
  category text not null,
  subtype text,
  amount_ml numeric,
  original_amount numeric,
  original_unit text,
  measurement_status text not null
    check (measurement_status in ('measured', 'container_estimated', 'approximate', 'unmeasured')),
  container_id uuid references public.containers (id) on delete set null,
  container_fraction numeric,
  episode_count integer,
  water_content_percent numeric,
  estimated_water_contribution_ml numeric,
  event_time timestamptz not null,
  recorded_time timestamptz not null default now(),
  entered_by text not null default '',
  input_method text not null default 'manual' check (input_method in ('tap', 'manual', 'voice')),
  original_transcript text,
  note text,
  edited boolean not null default false,
  deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fluid_events_profile_time_idx on public.fluid_events (profile_id, event_time desc);

alter table public.fluid_events enable row level security;

create policy "owners can manage their fluid events" on public.fluid_events
  for all using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Edit history: append-only audit trail for fluid_events.
-- ---------------------------------------------------------------------------
create table if not exists public.edit_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.fluid_events (id) on delete cascade,
  field text not null,
  previous_value text,
  new_value text,
  edited_by text not null default '',
  edited_time timestamptz not null default now(),
  reason text
);

alter table public.edit_history enable row level security;

create policy "owners can manage edit history for their events" on public.edit_history
  for all using (
    exists (
      select 1 from public.fluid_events e
      join public.profiles p on p.id = e.profile_id
      where e.id = event_id and p.owner_user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.fluid_events e
      join public.profiles p on p.id = e.profile_id
      where e.id = event_id and p.owner_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Weight and symptom entries.
-- ---------------------------------------------------------------------------
create table if not exists public.weight_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  weight_kg numeric not null,
  time timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.symptom_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  symptom text not null,
  severity text not null check (severity in ('mild', 'moderate', 'severe')),
  time timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

alter table public.weight_events enable row level security;
alter table public.symptom_events enable row level security;

create policy "owners can manage their weight events" on public.weight_events
  for all using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())
  );

create policy "owners can manage their symptom events" on public.symptom_events
  for all using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Reminders and quick-button preferences.
-- ---------------------------------------------------------------------------
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('record_drink', 'record_output', 'daily_weight', 'evening_review', 'check_forgotten')),
  enabled boolean not null default false,
  interval_hours numeric,
  last_fired_at timestamptz,
  snoozed_until timestamptz
);

alter table public.reminders enable row level security;

create policy "owners can manage their reminders" on public.reminders
  for all using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Account deletion requests — audit record of a user's request to permanently
-- delete their account; actual erasure is handled by a service-role process.
-- ---------------------------------------------------------------------------
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  request_time timestamptz not null default now(),
  completion_status text not null default 'pending' check (completion_status in ('pending', 'completed', 'cancelled'))
);

alter table public.account_deletion_requests enable row level security;

create policy "users can create their own deletion request" on public.account_deletion_requests
  for insert with check (auth.uid() = user_id);
create policy "users can view their own deletion request" on public.account_deletion_requests
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance for fluid_events.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger fluid_events_set_updated_at
  before update on public.fluid_events
  for each row execute function public.set_updated_at();
