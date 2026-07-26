// Healthcare workspace ("organisation") management — creating a new team,
// joining an existing one via invite code, generating invite codes, and
// listing a workspace's staff roster. Every write here goes through a
// security-definer RPC (see supabase/migrations/0004_care_teams.sql) rather
// than a raw table insert, so "who can join what" is enforced server-side,
// not by trusting this client code to call things in the right order.
//
// Same normalized-result convention as ./auth.ts: never throw, resolve to a
// typed { error } shape (or "not configured" when no backend is set up),
// per CLAUDE.md's "backend is optional" rule.

import { supabase, isSupabaseConfigured } from "./client";

export interface NormalizedOrgError {
  message: string;
}

const NOT_CONFIGURED_ERROR: NormalizedOrgError = {
  message: "Supabase is not configured.",
};

const GENERIC_ERROR_MESSAGE =
  "Something went wrong. Please try again in a moment.";

function normalizeError(
  error: { message: string } | null | undefined
): NormalizedOrgError | null {
  if (!error) return null;
  const message = error.message?.trim();
  // RPC exceptions (raise exception '...') surface here with a useful,
  // human-written message — pass those through as-is rather than masking
  // them, unlike a raw Postgres/network error which gets the generic message.
  const isUsefulMessage = Boolean(message);
  return { message: isUsefulMessage ? message : GENERIC_ERROR_MESSAGE };
}

export interface CreateOrganisationResult {
  organisationId: string | null;
  error: NormalizedOrgError | null;
}

export async function createOrganisation(
  name: string
): Promise<CreateOrganisationResult> {
  if (!supabase) {
    return { organisationId: null, error: NOT_CONFIGURED_ERROR };
  }
  const { data, error } = await supabase.rpc("create_organisation", {
    p_name: name,
  });
  return {
    organisationId: error ? null : (data as string),
    error: normalizeError(error),
  };
}

export interface RedeemInviteResult {
  organisationId: string | null;
  error: NormalizedOrgError | null;
}

export async function redeemOrganisationInvite(
  code: string
): Promise<RedeemInviteResult> {
  if (!supabase) {
    return { organisationId: null, error: NOT_CONFIGURED_ERROR };
  }
  const { data, error } = await supabase.rpc("redeem_organisation_invite", {
    p_code: code,
  });
  return {
    organisationId: error ? null : (data as string),
    error: normalizeError(error),
  };
}

/**
 * Redeems a clinic invite code on behalf of a patient/carer's own profile —
 * distinct from redeemOrganisationInvite, which is staff-only (it inserts
 * into organisation_members, whose role column can't hold a patient/carer
 * role at all). This just validates the code and sets organisation_id on a
 * profile the caller owns (see 0005_patient_clinic_invite.sql).
 */
export async function redeemPatientClinicInvite(
  code: string,
  profileId: string
): Promise<RedeemInviteResult> {
  if (!supabase) {
    return { organisationId: null, error: NOT_CONFIGURED_ERROR };
  }
  const { data, error } = await supabase.rpc("redeem_patient_clinic_invite", {
    p_code: code,
    p_profile_id: profileId,
  });
  return {
    organisationId: error ? null : (data as string),
    error: normalizeError(error),
  };
}

export interface CreateInviteResult {
  code: string | null;
  error: NormalizedOrgError | null;
}

export async function createOrganisationInvite(
  organisationId: string,
  expiresAt?: Date
): Promise<CreateInviteResult> {
  if (!supabase) {
    return { code: null, error: NOT_CONFIGURED_ERROR };
  }
  const { data, error } = await supabase.rpc("create_organisation_invite", {
    p_organisation_id: organisationId,
    p_expires_at: expiresAt ? expiresAt.toISOString() : null,
  });
  return {
    code: error ? null : (data as string),
    error: normalizeError(error),
  };
}

export interface OrganisationMemberRow {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  displayName: string | null;
}

export interface ListMembersResult {
  members: OrganisationMemberRow[];
  error: NormalizedOrgError | null;
}

/**
 * The signed-in user's current organisation, if they belong to one. A
 * healthcare account belongs to at most one organisation in this model —
 * multi-workspace membership isn't supported (a real deployment might want
 * that later; not needed for this prototype's single-team-per-account flow).
 */
export interface MyOrganisationResult {
  organisationId: string | null;
  organisationName: string | null;
  error: NormalizedOrgError | null;
}

export async function getMyOrganisation(): Promise<MyOrganisationResult> {
  if (!supabase) {
    return {
      organisationId: null,
      organisationName: null,
      error: NOT_CONFIGURED_ERROR,
    };
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return {
      organisationId: null,
      organisationName: null,
      error: normalizeError(userError),
    };
  }
  const { data, error } = await supabase
    .from("organisation_members")
    .select("organisation_id, organisations(id, name)")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();
  if (error) {
    return {
      organisationId: null,
      organisationName: null,
      error: normalizeError(error),
    };
  }
  if (!data) {
    return { organisationId: null, organisationName: null, error: null };
  }
  const org = data.organisations as unknown as {
    id: string;
    name: string;
  } | null;
  return {
    organisationId: org?.id ?? data.organisation_id,
    organisationName: org?.name ?? null,
    error: null,
  };
}

export async function listOrganisationMembers(
  organisationId: string
): Promise<ListMembersResult> {
  if (!supabase) {
    return { members: [], error: NOT_CONFIGURED_ERROR };
  }
  const { data, error } = await supabase
    .from("organisation_members")
    .select("id, user_id, role, joined_at, users(display_name)")
    .eq("organisation_id", organisationId)
    .order("joined_at", { ascending: true });
  if (error) {
    return { members: [], error: normalizeError(error) };
  }
  const members: OrganisationMemberRow[] = (data ?? []).map((row) => {
    const user = row.users as unknown as { display_name: string } | null;
    return {
      id: row.id as string,
      userId: row.user_id as string,
      role: row.role as string,
      joinedAt: row.joined_at as string,
      displayName: user?.display_name ?? null,
    };
  });
  return { members, error: null };
}

export { isSupabaseConfigured };
