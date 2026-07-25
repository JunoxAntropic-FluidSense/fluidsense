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
async function upsertUserRow(authUserId: string): Promise<void> {
  // Re-check right here, at the moment of the call — not from a value
  // captured earlier in this function's caller. This is intentionally
  // re-evaluated even though callers already checked, because store state
  // (viewContext) can change between a subscriber firing and this async
  // function actually running.
  if (!canSyncNow()) return;
  try {
    const row = toUsersRowUpsert(authUserId, useStore.getState());
    // supabase is guaranteed non-null here: canSyncNow() already confirmed
    // isSupabaseConfigured(), and client.ts only exports a non-null client
    // when configured.
    await supabase!.from("users").upsert(row);
  } catch {
    // Best-effort only — swallow. Never let a sync failure surface to the
    // user or interrupt the local-first flow.
  }
}

/**
 * Upserts just `role`/`mode` for `authUserId`, bypassing the reactive
 * store-subscription path above. `public.users.role` normally only gets
 * written once `completeOnboarding()` runs and `currentUser` changes — too
 * late for a role-gated RPC called *during* onboarding itself (e.g.
 * create_organisation, which checks the caller's public.users.role; see
 * 0004_care_teams.sql). Partial upsert is safe: every other column on
 * public.users has a database default, so this either inserts a new row
 * with those defaults or updates only role/mode on an existing one — it
 * never blanks out fields a prior full sync already wrote. Returns whether
 * the write is confirmed to have landed, so a caller gating a role-checked
 * action can wait for `true` instead of racing a fire-and-forget sync.
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
    }
    // Re-checked live inside upsertUserRow/canSyncNow — not gated here.
    void upsertUserRow(authUserId);
  } else if (authState.status === "signed-out") {
    if (lastLinkedAuthUserId !== null) {
      lastLinkedAuthUserId = null;
      unlinkAuthAccount();
    }
  }
}

/**
 * Fires on every useStore change. Only pushes a sync when fields that
 * actually feed the public.users row changed (currentUser, or the
 * active-patient/units mirror) — but the safety-critical guard is inside
 * upsertUserRow/canSyncNow, re-read via getState() at call time, not here.
 * This function must never assume "signed in" or "live" based on values
 * captured before this invocation.
 */
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

  void upsertUserRow(authState.user.id);
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
