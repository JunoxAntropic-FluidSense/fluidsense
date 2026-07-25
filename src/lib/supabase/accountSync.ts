// Best-effort background sync of the public.users row for the signed-in
// account. Mirrors AppUser fields (display name, role, mode, timezone,
// onboarding-completed, save-voice-transcripts) plus preferred_units (see
// mapping note on activePatientUnits below, since AppUser has no units field
// of its own) whenever there is a real, signed-in Supabase session.
//
// Scope is deliberately narrow: this file only ever touches public.users. No
// profiles/fluid_events/etc. sync happens here (see issue #0005).
//
// CLAUDE.md hard rule this file exists to protect: demo mode must NEVER touch
// Supabase, under any code path. viewContext is NOT swapped by
// enterDemoMode/exitDemoMode alongside currentUser/authUserId (see
// useStore.ts), so this module cannot treat "currentUser changed" or "auth
// state changed" as a proxy for "safe to sync" — it must read
// useStore.getState().viewContext explicitly, at the moment of every single
// Supabase call, never from a value captured earlier by a subscriber. A
// zustand `subscribe` callback fires on ANY store change (including the
// change that flips viewContext itself), so anything less than a fresh
// getState() read at the call site could fire mid-demo-transition.

import { supabase, isSupabaseConfigured } from "./client";
import { useAuthStore } from "../../store/useAuthStore";
import { useStore } from "../../store/useStore";

type StoreSnapshot = ReturnType<typeof useStore.getState>;

/**
 * The single guard every Supabase-touching call in this file must re-check,
 * live, at the moment of the call. Never cache this result across an await
 * or store it in a closure captured outside the call site.
 */
function canSyncNow(): boolean {
  return isSupabaseConfigured() && useStore.getState().viewContext === "live";
}

interface UsersRowUpsert {
  id: string;
  display_name: string;
  role: string;
  mode: string;
  timezone: string;
  preferred_units: string;
  onboarding_completed: boolean;
  save_voice_transcripts: boolean;
}

/**
 * preferred_units mapping decision: AppUser (src/types.ts) has no units field
 * of its own — units live per-patient on PatientProfile.units. There is no
 * single canonical "account units" value, so this mirrors the *active*
 * patient's units (state.patients.find by state.activePatientId), falling
 * back to "mL" if there's no active patient yet (e.g. immediately after
 * sign-in, before onboarding has created one). This is a best-effort,
 * display-oriented mirror only — it is never read back into patient state,
 * and switching active patients does not retroactively change history.
 */
function activePatientUnits(state: StoreSnapshot): string {
  const patient = state.patients.find((p) => p.id === state.activePatientId);
  return patient?.units ?? "mL";
}

function toUsersRowUpsert(
  authUserId: string,
  state: StoreSnapshot
): UsersRowUpsert {
  const { currentUser } = state;
  return {
    id: authUserId,
    display_name: currentUser.displayName,
    role: currentUser.role,
    mode: currentUser.mode,
    timezone: currentUser.timezone,
    preferred_units: activePatientUnits(state),
    onboarding_completed: currentUser.onboardingCompleted,
    save_voice_transcripts: currentUser.saveVoiceTranscripts,
  };
}

/**
 * Best-effort upsert of the public.users row for `authUserId`. Never throws:
 * any failure (network, RLS, offline, misconfiguration) is swallowed — this
 * is a background convenience sync, not a critical path, and must never
 * block or surface errors in the local-first UI.
 */
import { pullOrganisationData } from "./patientSync";
import { getMyOrganisation } from "./organisations";
import type { Role, Mode } from "../../types";

/**
 * Pulls the public.users row from Supabase on sign-in and merges it into useStore.
 * Restores onboardingCompleted, displayName, role, mode, timezone, and workspace organisation.
 */
export async function pullUserRow(authUserId: string): Promise<void> {
  if (!canSyncNow()) return;
  try {
    const { data: userRow } = await supabase!
      .from("users")
      .select("*")
      .eq("id", authUserId)
      .maybeSingle();

    if (userRow) {
      const userMode = (userRow.mode as Mode) || "patient";
      const userRole = (userRow.role as Role) || "patient";
      const orgResult = await getMyOrganisation();

      useStore.setState((state) => ({
        mode: userMode,
        currentUser: {
          ...state.currentUser,
          mode: userMode,
          role: userRole,
          displayName: userRow.display_name || state.currentUser.displayName,
          timezone: userRow.timezone || state.currentUser.timezone,
          onboardingCompleted:
            userRow.onboarding_completed ??
            state.currentUser.onboardingCompleted,
          saveVoiceTranscripts:
            userRow.save_voice_transcripts ??
            state.currentUser.saveVoiceTranscripts,
          organisationId:
            orgResult.organisationId ?? state.currentUser.organisationId,
          organisationName:
            orgResult.organisationName ?? state.currentUser.organisationName,
        },
      }));
      void pullOrganisationData();
    }
  } catch {
    // Best-effort only — swallow errors
  }
}

/**
 * Best-effort upsert of the public.users row for `authUserId`. Never throws:
 * any failure (network, RLS, offline, misconfiguration) is swallowed — this
 * is a background convenience sync, not a critical path, and must never
 * block or surface errors in the local-first UI.
 */
async function upsertUserRow(authUserId: string): Promise<void> {
  if (!canSyncNow()) return;
  try {
    const row = toUsersRowUpsert(authUserId, useStore.getState());
    await supabase!.from("users").upsert(row);
  } catch {
    // Best-effort only — swallow.
  }
}

/**
 * Upserts just `role`/`mode` for `authUserId`, bypassing the reactive
 * store-subscription path above.
 */
export async function syncAccountRoleNow(
  authUserId: string,
  role: string,
  mode: string
): Promise<boolean> {
  if (!canSyncNow()) return false;
  try {
    await supabase!.from("users").upsert({ id: authUserId, role, mode });
    return true;
  } catch {
    return false;
  }
}

let lastLinkedAuthUserId: string | null = null;

function handleAuthChange(): void {
  const authState = useAuthStore.getState();
  const { linkAuthAccount, unlinkAuthAccount } = useStore.getState();

  if (authState.status === "signed-in" && authState.user) {
    const authUserId = authState.user.id;
    if (lastLinkedAuthUserId !== authUserId) {
      lastLinkedAuthUserId = authUserId;
      linkAuthAccount(authUserId);
      void pullUserRow(authUserId);
    }
  } else if (authState.status === "signed-out") {
    if (
      lastLinkedAuthUserId !== null ||
      useStore.getState().authUserId !== null
    ) {
      lastLinkedAuthUserId = null;
      unlinkAuthAccount();
      useStore.getState().resetAccount();
    }
  }
}

function handleStoreChange(
  state: StoreSnapshot,
  prevState: StoreSnapshot
): void {
  const authState = useAuthStore.getState();
  if (!(authState.status === "signed-in" && authState.user)) return;

  const relevantChanged =
    state.currentUser !== prevState.currentUser ||
    state.activePatientId !== prevState.activePatientId ||
    state.patients !== prevState.patients;
  if (!relevantChanged) return;

  if (
    state.currentUser.onboardingCompleted ||
    prevState.currentUser.onboardingCompleted
  ) {
    void upsertUserRow(authState.user.id);
  }
}

let unsubscribeAuth: (() => void) | null = null;
let unsubscribeStore: (() => void) | null = null;
let started = false;

/**
 * Starts the background subscriptions. Idempotent — safe to call more than
 * once (e.g. under React StrictMode double-invoking effects). No-ops
 * entirely (still safe to call) when Supabase isn't configured, since
 * canSyncNow() would reject every call anyway; the subscriptions are cheap
 * to keep registered regardless.
 */
export function startAccountSync(): void {
  if (started) return;
  started = true;
  unsubscribeAuth = useAuthStore.subscribe(handleAuthChange);
  unsubscribeStore = useStore.subscribe(handleStoreChange);
  // Run once immediately in case auth state already settled before this
  // module started observing it (e.g. this is wired after getSession()
  // already resolved).
  handleAuthChange();
}

/** Stops the background subscriptions. Exposed mainly for tests/cleanup. */
export function stopAccountSync(): void {
  unsubscribeAuth?.();
  unsubscribeStore?.();
  unsubscribeAuth = null;
  unsubscribeStore = null;
  started = false;
}
