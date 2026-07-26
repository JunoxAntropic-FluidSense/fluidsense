-- Patients linking their own record to a clinic via invite code.
--
-- Problem this fixes: PatientClinicSharingCard.tsx lets a patient/carer enter
-- a clinic's invite code to share their record with that clinic's care team.
-- It was calling redeem_organisation_invite (0004_care_teams.sql), but that
-- RPC exists solely for staff joining a workspace roster: it inserts into
-- organisation_members, whose role column is check-constrained to
-- ('nurse', 'healthcare_assistant', 'clinician') and hard-rejects any caller
-- without one of those roles. A patient account can never redeem an invite
-- through that path — not a client bug, a missing server capability.
--
-- Linking a patient's own profile to a clinic doesn't need organisation_members
-- membership at all — 0004_care_teams.sql's RLS on profiles already grants
-- clinic staff access to any profile with a matching organisation_id, purely
-- via profiles.organisation_id. So this RPC only needs to validate the code
-- and set that one column on a profile the caller actually owns.
create or replace function public.redeem_patient_clinic_invite(
  p_code text,
  p_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite record;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_profile_id and owner_user_id = auth.uid()
  ) then
    raise exception 'You do not own this patient profile.';
  end if;

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

  update public.profiles
  set organisation_id = v_invite.organisation_id
  where id = p_profile_id;

  return v_invite.organisation_id;
end;
$$;

grant execute on function public.redeem_patient_clinic_invite(text, uuid) to authenticated;
