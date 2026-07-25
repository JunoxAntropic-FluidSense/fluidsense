-- Care teams / healthcare workspaces.
--
-- Problem this fixes: every table so far is scoped to a single
-- `owner_user_id` (see 0001_init.sql). A "patient" record belongs to exactly
-- one login. That's correct for a patient/carer tracking themselves, but
-- wrong for a healthcare account — a ward or team of nurses/clinicians is
-- supposed to share one roster of patients, and nothing in the schema lets
-- more than one login see the same profile. There was also no registration
-- flow: a healthcare signup had nowhere to create or join a team.
--
-- This migration adds a workspace ("organisation") layer patients can
-- optionally belong to, on top of the existing owner_user_id model rather
-- than replacing it — a patient-mode profile (organisation_id null) still
-- works exactly as before. A healthcare-mode profile gets organisation_id
-- set, and RLS grants access to any member of that organisation, not just
-- whoever created the row.
--
-- Joining/creating a workspace goes through security-definer RPCs
-- (create_organisation, redeem_organisation_invite, create_organisation_invite)
-- rather than raw INSERT policies on organisation_members/organisation_invites
-- — this keeps "who can join what" enforced entirely server-side instead of
-- trusting client-side logic to only call insert with a validated code.

-- ---------------------------------------------------------------------------
-- Organisations (healthcare workspaces).
-- ---------------------------------------------------------------------------
create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.organisations enable row level security;

-- ---------------------------------------------------------------------------
-- Organisation membership (the staff roster).
-- ---------------------------------------------------------------------------
create table if not exists public.organisation_members (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null
    check (role in ('nurse', 'healthcare_assistant', 'clinician')),
  joined_at timestamptz not null default now(),
  unique (organisation_id, user_id)
);

alter table public.organisation_members enable row level security;

-- ---------------------------------------------------------------------------
-- Helper: is the calling user a member of this organisation? Security
-- definer so it can be used inside RLS policies on other tables without
-- those policies needing their own visibility into organisation_members.
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.organisation_members m
    where m.organisation_id = p_org_id and m.user_id = auth.uid()
  );
$$;

grant execute on function public.is_org_member(uuid) to authenticated;

create policy "members can view their organisation" on public.organisations
  for select using (public.is_org_member(id));

create policy "members can rename their organisation" on public.organisations
  for update using (public.is_org_member(id)) with check (public.is_org_member(id));

create policy "members can view their organisation's roster" on public.organisation_members
  for select using (public.is_org_member(organisation_id));

create policy "members can leave an organisation" on public.organisation_members
  for delete using (user_id = auth.uid());

-- No insert policy on either table — joining/creating only happens through
-- the security-definer RPCs below, which run with elevated privilege for
-- exactly this one purpose and nothing else.

-- ---------------------------------------------------------------------------
-- Invites: how a staff member actually joins an existing organisation.
-- ---------------------------------------------------------------------------
create table if not exists public.organisation_invites (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked boolean not null default false
);

alter table public.organisation_invites enable row level security;

create policy "members can view their organisation's invites" on public.organisation_invites
  for select using (public.is_org_member(organisation_id));

create policy "members can revoke their organisation's invites" on public.organisation_invites
  for update using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));

-- ---------------------------------------------------------------------------
-- RPCs: the only three ways membership/invite rows ever get created.
-- ---------------------------------------------------------------------------

-- Create a brand-new workspace and become its first member. Role is taken
-- from the caller's own public.users row (set at onboarding).
create or replace function public.create_organisation(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_role text;
begin
  select role into v_role from public.users where id = auth.uid();
  if v_role is null or v_role not in ('clinician') then
    raise exception 'Only clinicians and team leads can create a workspace.';
  end if;

  insert into public.organisations (name, created_by)
  values (nullif(trim(p_name), ''), auth.uid())
  returning id into v_org_id;

  insert into public.organisation_members (organisation_id, user_id, role)
  values (v_org_id, auth.uid(), v_role);

  return v_org_id;
end;
$$;

grant execute on function public.create_organisation(text) to authenticated;

-- Generate a fresh, shareable invite code for an organisation the caller is
-- already a member of.
create or replace function public.create_organisation_invite(
  p_organisation_id uuid,
  p_expires_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_org_member(p_organisation_id) then
    raise exception 'Not a member of this organisation.';
  end if;

  -- 8-character, easy-to-read-aloud code — not a security boundary on its
  -- own (that's the revoked/expires_at checks below), just short enough to
  -- share verbally or by text.
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.organisation_invites (organisation_id, code, created_by, expires_at)
  values (p_organisation_id, v_code, auth.uid(), p_expires_at);

  return v_code;
end;
$$;

grant execute on function public.create_organisation_invite(uuid, timestamptz) to authenticated;

-- Redeem an invite code: validates it, then joins the caller to that
-- organisation using their own role from public.users. Raises on any
-- invalid/expired/revoked code rather than silently failing, so the client
-- can show a clear error.
create or replace function public.redeem_organisation_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite record;
  v_role text;
begin
  select * into v_invite from public.organisation_invites
  where code = upper(trim(p_code));

  if v_invite is null then
    raise exception 'Invite code not found.';
  end if;
  if v_invite.revoked then
    raise exception 'This invite has been revoked.';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'This invite has expired.';
  end if;

  select role into v_role from public.users where id = auth.uid();
  if v_role is null or v_role not in ('nurse', 'healthcare_assistant', 'clinician') then
    raise exception 'Only healthcare accounts can join a workspace.';
  end if;

  insert into public.organisation_members (organisation_id, user_id, role)
  values (v_invite.organisation_id, auth.uid(), v_role)
  on conflict (organisation_id, user_id) do nothing;

  return v_invite.organisation_id;
end;
$$;

grant execute on function public.redeem_organisation_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Patients can now belong to a workspace instead of (or alongside) a single
-- owner. Nullable: patient-mode profiles never set this and keep working
-- exactly as before, scoped only by owner_user_id.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists organisation_id uuid references public.organisations (id) on delete set null;

create index if not exists profiles_organisation_id_idx on public.profiles (organisation_id);

drop policy if exists "owners can manage their profiles" on public.profiles;
create policy "owners or org members can manage profiles" on public.profiles
  for all using (
    auth.uid() = owner_user_id
    or (organisation_id is not null and public.is_org_member(organisation_id))
  ) with check (
    auth.uid() = owner_user_id
    or (organisation_id is not null and public.is_org_member(organisation_id))
  );

-- ---------------------------------------------------------------------------
-- Every table that hangs off profile_id: same "owner OR org member" rule,
-- replacing the owner-only policies from 0001_init.sql.
-- ---------------------------------------------------------------------------
drop policy if exists "owners can manage monitoring periods" on public.monitoring_periods;
create policy "owners or org members can manage monitoring periods" on public.monitoring_periods
  for all using (
    exists (
      select 1 from public.profiles p where p.id = profile_id
      and (p.owner_user_id = auth.uid()
        or (p.organisation_id is not null and public.is_org_member(p.organisation_id)))
    )
  ) with check (
    exists (
      select 1 from public.profiles p where p.id = profile_id
      and (p.owner_user_id = auth.uid()
        or (p.organisation_id is not null and public.is_org_member(p.organisation_id)))
    )
  );

drop policy if exists "owners can manage their containers" on public.containers;
create policy "owners or org members can manage containers" on public.containers
  for all using (
    exists (
      select 1 from public.profiles p where p.id = profile_id
      and (p.owner_user_id = auth.uid()
        or (p.organisation_id is not null and public.is_org_member(p.organisation_id)))
    )
  ) with check (
    exists (
      select 1 from public.profiles p where p.id = profile_id
      and (p.owner_user_id = auth.uid()
        or (p.organisation_id is not null and public.is_org_member(p.organisation_id)))
    )
  );

drop policy if exists "owners can manage their saved fluids" on public.saved_fluids;
create policy "owners or org members can manage saved fluids" on public.saved_fluids
  for all using (
    exists (
      select 1 from public.profiles p where p.id = profile_id
      and (p.owner_user_id = auth.uid()
        or (p.organisation_id is not null and public.is_org_member(p.organisation_id)))
    )
  ) with check (
    exists (
      select 1 from public.profiles p where p.id = profile_id
      and (p.owner_user_id = auth.uid()
        or (p.organisation_id is not null and public.is_org_member(p.organisation_id)))
    )
  );

drop policy if exists "owners can manage their fluid events" on public.fluid_events;
create policy "owners or org members can manage fluid events" on public.fluid_events
  for all using (
    exists (
      select 1 from public.profiles p where p.id = profile_id
      and (p.owner_user_id = auth.uid()
        or (p.organisation_id is not null and public.is_org_member(p.organisation_id)))
    )
  ) with check (
    exists (
      select 1 from public.profiles p where p.id = profile_id
      and (p.owner_user_id = auth.uid()
        or (p.organisation_id is not null and public.is_org_member(p.organisation_id)))
    )
  );

drop policy if exists "owners can manage edit history for their events" on public.edit_history;
create policy "owners or org members can manage edit history" on public.edit_history
  for all using (
    exists (
      select 1 from public.fluid_events e
      join public.profiles p on p.id = e.profile_id
      where e.id = event_id
      and (p.owner_user_id = auth.uid()
        or (p.organisation_id is not null and public.is_org_member(p.organisation_id)))
    )
  ) with check (
    exists (
      select 1 from public.fluid_events e
      join public.profiles p on p.id = e.profile_id
      where e.id = event_id
      and (p.owner_user_id = auth.uid()
        or (p.organisation_id is not null and public.is_org_member(p.organisation_id)))
    )
  );

drop policy if exists "owners can manage their weight events" on public.weight_events;
create policy "owners or org members can manage weight events" on public.weight_events
  for all using (
    exists (
      select 1 from public.profiles p where p.id = profile_id
      and (p.owner_user_id = auth.uid()
        or (p.organisation_id is not null and public.is_org_member(p.organisation_id)))
    )
  ) with check (
    exists (
      select 1 from public.profiles p where p.id = profile_id
      and (p.owner_user_id = auth.uid()
        or (p.organisation_id is not null and public.is_org_member(p.organisation_id)))
    )
  );

drop policy if exists "owners can manage their symptom events" on public.symptom_events;
create policy "owners or org members can manage symptom events" on public.symptom_events
  for all using (
    exists (
      select 1 from public.profiles p where p.id = profile_id
      and (p.owner_user_id = auth.uid()
        or (p.organisation_id is not null and public.is_org_member(p.organisation_id)))
    )
  ) with check (
    exists (
      select 1 from public.profiles p where p.id = profile_id
      and (p.owner_user_id = auth.uid()
        or (p.organisation_id is not null and public.is_org_member(p.organisation_id)))
    )
  );

drop policy if exists "owners can manage their reminders" on public.reminders;
create policy "owners or org members can manage reminders" on public.reminders
  for all using (
    exists (
      select 1 from public.profiles p where p.id = profile_id
      and (p.owner_user_id = auth.uid()
        or (p.organisation_id is not null and public.is_org_member(p.organisation_id)))
    )
  ) with check (
    exists (
      select 1 from public.profiles p where p.id = profile_id
      and (p.owner_user_id = auth.uid()
        or (p.organisation_id is not null and public.is_org_member(p.organisation_id)))
    )
  );

-- push_subscriptions (0003_checkin_push.sql) is per-device/per-profile, not
-- something another org member should manage on someone else's behalf — left
-- as owner-only intentionally, not extended to org membership.

-- ---------------------------------------------------------------------------
-- Realtime: so one staff member's changes appear live for the rest of their
-- organisation (see src/lib/supabase/patientSync.ts), profiles and
-- fluid_events need to be in the standard supabase_realtime publication.
-- Broadcast access is still governed by each row's RLS policy above — this
-- only turns broadcasting on for the table, it does not widen who can see
-- what. Wrapped in a DO block since re-adding an already-added table raises
-- an error rather than a no-op.
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.fluid_events;
exception when duplicate_object then null;
end $$;
