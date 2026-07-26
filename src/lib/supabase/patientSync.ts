// Bidirectional sync of patients (profiles) and fluid_events between this
// device and Supabase.
//
// Why this file exists: 0001_init.sql's RLS already grants an account
// permission to see its own rows (and 0004_care_teams.sql extends that to
// org members), but permission is meaningless if nothing ever leaves the
// device that recorded it. Before this file, patients/events lived only in
// this browser's localStorage (persisted via zustand's `persist` middleware
// in useStore.ts) with no server round-trip at all.
//
// Scope: profiles + fluid_events only — the two tables that determine
// whether a patient and their record are visible anywhere but this device.
// weight/symptom/medication/dialysis events, reminders, containers, and
// saved fluids stay local-only for now; extending sync to those is a
// mechanical repeat of the same push/pull/realtime pattern below, deferred
// rather than built here to keep this change reviewable.
//
// Two independent sync scopes live here, gated separately:
//  - Owned sync (canSyncNow): any signed-in "live" account pushes/pulls its
//    OWN patients/events (profiles.owner_user_id = this account), regardless
//    of workspace membership. This is what makes a solo patient's own record
//    exist server-side at all — without it, an "independent" patient profile
//    is purely local and can never be linked to a clinic later (nothing to
//    point an invite-redeemed organisation_id at).
//  - Org sync (canSyncOrgNow): additionally, once an account has joined/
//    created a healthcare workspace, the whole org roster + its events pull
//    down and stay live via realtime — this is what makes "which patients
//    show up" work across a team, not just RLS-permitted in theory.
//
// Push: on any local patients/events change, diff by object reference
// against the previous state (zustand always produces a new array/object on
// mutation here — see useStore.ts's addEvent/updateEvent/addPatient — so
// reference inequality per id is a reliable "this one changed" signal) and
// upsert just the rows that changed.
//
// Pull: once on sign-in, then again whenever a realtime postgres_changes
// notification fires for profiles/fluid_events (org sync only) — refetches
// and merges into the local store (remote authoritative for anything it
// has; any local patient/event not yet represented remotely is kept as-is,
// since it may simply not have pushed yet).

import { supabase, isSupabaseConfigured } from "./client";
import { useStore, newQuickButtons } from "../../store/useStore";
import type { PatientProfile, FluidEvent } from "../../types";

type StoreSnapshot = ReturnType<typeof useStore.getState>;
type RealtimeChannel = ReturnType<NonNullable<typeof supabase>["channel"]>;

function canSyncNow(): boolean {
  return isSupabaseConfigured() && useStore.getState().viewContext === "live";
}

/** Additionally gated on the account actually belonging to a workspace. */
function canSyncOrgNow(): boolean {
  if (!canSyncNow()) return false;
  const state = useStore.getState();
  const { currentUser, patients, activePatientId } = state;
  const activePatient = patients.find((p) => p.id === activePatientId);
  return (
    (currentUser.mode === "healthcare" &&
      Boolean(currentUser.organisationId)) ||
    Boolean(activePatient?.organisationId)
  );
}

// --- profiles (patients): client <-> row mapping ---------------------------

interface ProfileRow {
  id: string;
  owner_user_id: string;
  organisation_id: string | null;
  display_name: string;
  care_setting: string;
  monitoring_reason: string | null;
  units: string;
  monitoring_day_start_mode: string;
  monitoring_day_custom_hour: number | null;
  daily_allowance_ml: number | null;
  allowance_set_by_name: string | null;
  allowance_set_by_role: string | null;
  allowance_set_at: string | null;
  daily_weight_enabled: boolean;
  contact_instructions: string | null;
  is_demo: boolean;
}

function toProfileRow(
  p: PatientProfile,
  ownerUserId: string,
  organisationId: string | null
): ProfileRow {
  return {
    id: p.id,
    // Only meaningful on first insert — see the migration's comment on why
    // an upsert overwriting this on every push is an accepted, non-security-
    // relevant imprecision (org membership is what actually gates access).
    owner_user_id: ownerUserId,
    organisation_id: organisationId,
    display_name: p.displayName,
    care_setting: p.careSetting,
    monitoring_reason: p.monitoringReason ?? null,
    units: p.units,
    monitoring_day_start_mode: p.monitoringDayStartMode,
    monitoring_day_custom_hour: p.monitoringDayCustomHour ?? null,
    daily_allowance_ml: p.allowance?.dailyMl ?? null,
    allowance_set_by_name: p.allowance?.setByName ?? null,
    allowance_set_by_role: p.allowance?.setByRole ?? null,
    allowance_set_at: p.allowance?.setAt ?? null,
    daily_weight_enabled: p.dailyWeightEnabled,
    contact_instructions: p.contactInstructions ?? null,
    is_demo: p.isDemo ?? false,
  };
}

function fromProfileRow(
  row: ProfileRow,
  existing?: PatientProfile
): PatientProfile {
  return {
    // Fields with no server column yet (favouriteFluidIds, containers,
    // quickButtons, reminders, careTeamContacts, etc.) fall back to whatever
    // this device already has locally for that id, or a sensible default for
    // a patient this device has never seen before. quickButtons specifically
    // can't default to an empty array — completeOnboarding() always gives a
    // freshly-created patient the standard set (newQuickButtons()), and a
    // patient restored via pull (a fresh device, or local storage cleared)
    // should land in the same usable state, not a Quick Add grid with
    // nothing in it.
    ...(existing ?? {
      favouriteFluidIds: [],
      containers: [],
      quickButtons: newQuickButtons(),
      reminders: [],
    }),
    // Self-heal a patient that already merged in with an empty array before
    // this fallback existed — an onboarded patient should never actually
    // have zero quick buttons, so treat empty the same as "unset".
    quickButtons:
      existing?.quickButtons && existing.quickButtons.length > 0
        ? existing.quickButtons
        : newQuickButtons(),
    id: row.id,
    displayName: row.display_name,
    careSetting: row.care_setting,
    monitoringReason: row.monitoring_reason ?? undefined,
    units: row.units as PatientProfile["units"],
    monitoringDayStartMode:
      row.monitoring_day_start_mode as PatientProfile["monitoringDayStartMode"],
    monitoringDayCustomHour: row.monitoring_day_custom_hour ?? undefined,
    dailyWeightEnabled: row.daily_weight_enabled,
    contactInstructions: row.contact_instructions ?? undefined,
    isDemo: row.is_demo,
    organisationId: row.organisation_id ?? undefined,
    allowance:
      row.daily_allowance_ml != null && row.allowance_set_at
        ? {
            dailyMl: row.daily_allowance_ml,
            setByName: row.allowance_set_by_name ?? "",
            setByRole: (row.allowance_set_by_role ??
              "clinician") as PatientProfile["allowance"] extends infer A
              ? A extends { setByRole: infer R }
                ? R
                : never
              : never,
            setAt: row.allowance_set_at,
          }
        : undefined,
  };
}

// --- fluid_events: client <-> row mapping -----------------------------------

interface FluidEventRow {
  id: string;
  profile_id: string;
  monitoring_period_id: string | null;
  direction: string;
  category: string;
  subtype: string | null;
  amount_ml: number | null;
  original_unit: string | null;
  measurement_status: string;
  container_id: string | null;
  container_fraction: number | null;
  episode_count: number | null;
  water_content_percent: number | null;
  estimated_water_contribution_ml: number | null;
  event_time: string;
  recorded_time: string;
  entered_by: string;
  input_method: string;
  original_transcript: string | null;
  note: string | null;
  edited: boolean;
  deleted: boolean;
  deleted_at: string | null;
}

function toFluidEventRow(e: FluidEvent): FluidEventRow {
  return {
    id: e.id,
    profile_id: e.patientId,
    monitoring_period_id: e.monitoringPeriodId ?? null,
    direction: e.direction,
    category: e.category,
    subtype: e.subtype ?? null,
    amount_ml: e.amountMl ?? null,
    // No dedicated "original amount before mL conversion" field on the
    // client type — original_unit is preserved for display purposes, the
    // amount itself is always the canonical mL value once recorded.
    original_unit: e.unit,
    measurement_status: e.status,
    container_id: e.containerId ?? null,
    container_fraction:
      typeof e.containerFraction === "number" ? e.containerFraction : null,
    episode_count: e.episodeCount ?? null,
    water_content_percent: e.waterContentPercent ?? null,
    estimated_water_contribution_ml: e.estimatedWaterContributionMl ?? null,
    event_time: e.eventTime,
    recorded_time: e.recordedTime,
    entered_by: e.enteredBy,
    input_method: e.inputMethod,
    original_transcript: e.transcript ?? null,
    note: e.note ?? null,
    edited: e.edited ?? false,
    deleted: e.deleted ?? false,
    deleted_at: e.deletedAt ?? null,
  };
}

function fromFluidEventRow(row: FluidEventRow): FluidEvent {
  return {
    id: row.id,
    patientId: row.profile_id,
    direction: row.direction as FluidEvent["direction"],
    category: row.category as FluidEvent["category"],
    subtype: row.subtype ?? undefined,
    amountMl: row.amount_ml ?? undefined,
    unit: (row.original_unit ?? "mL") as FluidEvent["unit"],
    status: row.measurement_status as FluidEvent["status"],
    episodeCount: row.episode_count ?? undefined,
    containerId: row.container_id ?? undefined,
    containerFraction: (row.container_fraction ??
      undefined) as FluidEvent["containerFraction"],
    waterContentPercent: row.water_content_percent ?? undefined,
    estimatedWaterContributionMl:
      row.estimated_water_contribution_ml ?? undefined,
    eventTime: row.event_time,
    recordedTime: row.recorded_time,
    enteredBy: row.entered_by,
    inputMethod: row.input_method as FluidEvent["inputMethod"],
    transcript: row.original_transcript ?? undefined,
    note: row.note ?? undefined,
    edited: row.edited,
    deleted: row.deleted,
    deletedAt: row.deleted_at ?? undefined,
    monitoringPeriodId: row.monitoring_period_id ?? undefined,
    // editHistory/photo fields aren't synced yet (see file header) — a
    // pulled event simply has none, even if the original device recorded
    // some; local edit history for a locally-created event is untouched
    // since fromFluidEventRow only ever produces *new* local objects for
    // rows this device hadn't seen before (see mergeById below).
  };
}

// --- push -------------------------------------------------------------------

function diffById<T extends { id: string }>(next: T[], prev: T[]): T[] {
  const prevById = new Map(prev.map((item) => [item.id, item]));
  return next.filter((item) => prevById.get(item.id) !== item);
}

async function pushPatients(changed: PatientProfile[]): Promise<void> {
  if (!supabase || changed.length === 0) return;
  const { currentUser, authUserId } = useStore.getState();
  if (!authUserId) return;
  try {
    // Every changed patient this account owns gets pushed, org or no org —
    // an "independent" patient still needs a real server-side row (so it
    // can later be linked to a clinic via invite code, see
    // PatientClinicSharingCard.tsx). organisation_id is nullable on the
    // profiles table precisely for this case.
    const rows = changed.map((p) =>
      toProfileRow(
        p,
        authUserId,
        p.organisationId || currentUser.organisationId || null
      )
    );
    if (rows.length > 0) {
      await supabase.from("profiles").upsert(rows);
    }
  } catch {
    // Best-effort only — see pushPatients.
  }
}

async function pushEvents(changed: FluidEvent[]): Promise<void> {
  if (!supabase || changed.length === 0) return;
  try {
    const rows = changed.map(toFluidEventRow);
    await supabase.from("fluid_events").upsert(rows);
  } catch {
    // Best-effort only — see pushPatients.
  }
}

// --- pull ---------------------------------------------------------------

function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const remoteById = new Map(remote.map((item) => [item.id, item]));
  const merged = local.map((item) => remoteById.get(item.id) ?? item);
  const localIds = new Set(local.map((item) => item.id));
  for (const item of remote) {
    if (!localIds.has(item.id)) merged.push(item);
  }
  return merged;
}

/**
 * Shared implementation behind pullOrganisationData/pullOwnedPatientData:
 * fetches profiles matching one column/value pair, plus their fluid_events,
 * and merges both into the local store. Best-effort and silent on failure —
 * a stale local copy (or an empty one, pre-first-sync) is a normal, expected
 * state, not an error condition worth surfacing mid-session.
 */
async function pullProfilesMatching(
  column: "organisation_id" | "owner_user_id",
  value: string
): Promise<void> {
  if (!supabase) return;
  try {
    const { data: profileRows, error: profilesError } = await supabase
      .from("profiles")
      .select(
        "id, owner_user_id, organisation_id, display_name, care_setting, monitoring_reason, units, monitoring_day_start_mode, monitoring_day_custom_hour, daily_allowance_ml, allowance_set_by_name, allowance_set_by_role, allowance_set_at, daily_weight_enabled, contact_instructions, is_demo"
      )
      .eq(column, value);
    if (profilesError || !profileRows) return;

    const localPatientsById = new Map(
      useStore.getState().patients.map((p) => [p.id, p])
    );
    const remotePatients = (profileRows as ProfileRow[]).map((row) =>
      fromProfileRow(row, localPatientsById.get(row.id))
    );

    const profileIds = remotePatients.map((p) => p.id);
    let remoteEvents: FluidEvent[] = [];
    if (profileIds.length > 0) {
      const { data: eventRows, error: eventsError } = await supabase
        .from("fluid_events")
        .select(
          "id, profile_id, monitoring_period_id, direction, category, subtype, amount_ml, original_unit, measurement_status, container_id, container_fraction, episode_count, water_content_percent, estimated_water_contribution_ml, event_time, recorded_time, entered_by, input_method, original_transcript, note, edited, deleted, deleted_at"
        )
        .in("profile_id", profileIds);
      if (!eventsError && eventRows) {
        remoteEvents = (eventRows as FluidEventRow[]).map(fromFluidEventRow);
      }
    }

    useStore.setState((s) => {
      const mergedPatients = mergeById(s.patients, remotePatients);
      const activePatientId =
        s.activePatientId &&
        mergedPatients.some((p) => p.id === s.activePatientId)
          ? s.activePatientId
          : (mergedPatients[0]?.id ?? s.activePatientId);

      return {
        patients: mergedPatients,
        events: mergeById(s.events, remoteEvents),
        activePatientId,
      };
    });
  } catch {
    // Best-effort only — see pushPatients.
  }
}

/**
 * Fetches the current workspace's full roster + event set and merges it
 * into the local store.
 */
export async function pullOrganisationData(): Promise<void> {
  if (!canSyncOrgNow() || !supabase) return;
  const state = useStore.getState();
  const activePatient = state.patients.find(
    (p) => p.id === state.activePatientId
  );
  const organisationId =
    state.currentUser.organisationId || activePatient?.organisationId;
  if (!organisationId) return;
  await pullProfilesMatching("organisation_id", organisationId);
}

/**
 * Fetches every profile this account directly owns (owner_user_id) and
 * merges it into the local store. Unlike pullOrganisationData, this isn't
 * gated on the account already being in a healthcare workspace — it's how a
 * patient/carer account's own patient(s) come back after a fresh sign-in on
 * a new device/browser, where the local store starts with zero patients and
 * so has no organisationId to key an org-roster pull off of. Without this,
 * such an account would restore onboardingCompleted=true but patients=[]
 * forever, which OnboardingFlow reads as "stale state" and re-shows the
 * onboarding wizard on every sign-in.
 */
export async function pullOwnedPatientData(ownerUserId: string): Promise<void> {
  if (!canSyncNow()) return;
  await pullProfilesMatching("owner_user_id", ownerUserId);
}

// --- subscriptions / lifecycle ----------------------------------------------

function handleStoreChange(
  state: StoreSnapshot,
  prevState: StoreSnapshot
): void {
  if (!canSyncNow()) return;

  if (state.patients !== prevState.patients) {
    const changed = diffById(state.patients, prevState.patients);
    if (changed.length > 0) void pushPatients(changed);
  }
  if (state.events !== prevState.events) {
    const changed = diffById(state.events, prevState.events);
    if (changed.length > 0) void pushEvents(changed);
  }
}

let realtimeChannel: RealtimeChannel | null = null;
let subscribedOrgId: string | null = null;

/**
 * (Re)subscribes to realtime changes for the current organisation, tearing
 * down any previous subscription first. No-ops if already subscribed to the
 * same org, or if sync isn't currently applicable.
 */
function ensureRealtimeSubscription(): void {
  if (!canSyncOrgNow() || !supabase) return;
  const organisationId = useStore.getState().currentUser.organisationId!;
  if (subscribedOrgId === organisationId && realtimeChannel) return;

  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  subscribedOrgId = organisationId;
  realtimeChannel = supabase
    .channel(`org-sync-${organisationId}`)
    // Filtered by RLS on the server side, not by a client-side filter param
    // — postgres_changes filters can't express "profile_id belongs to a
    // profile in my org" for fluid_events, but RLS (0004_care_teams.sql)
    // already only broadcasts rows this connection is allowed to select.
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "profiles" },
      () => {
        void pullOrganisationData();
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "fluid_events" },
      () => {
        void pullOrganisationData();
      }
    )
    .subscribe();
}

let unsubscribeStore: (() => void) | null = null;
let started = false;

/**
 * Starts patient/event sync: an initial pull, a realtime subscription for
 * live updates, and a store subscription that pushes local changes. Safe to
 * call unconditionally at app start (mirrors accountSync.ts's
 * startAccountSync) — every operation inside re-checks canSyncNow() live, so
 * this is a correct no-op until a healthcare account actually has a
 * workspace.
 */
export function startPatientSync(): void {
  if (started) return;
  started = true;
  unsubscribeStore = useStore.subscribe(handleStoreChange);
  // Flush once on start, not just on future changes — a patient created
  // before this device ever had owned-sync (or before this feature existed)
  // otherwise sits local-only forever, since handleStoreChange only pushes
  // on a subsequent mutation, never on load.
  if (canSyncNow()) void pushPatients(useStore.getState().patients);
  void pullOrganisationData();
  ensureRealtimeSubscription();
  // Re-evaluate on every store change too, cheaply — covers "just joined a
  // workspace" (organisationId went from unset to set) and "workspace
  // changed" without a separate auth-style event stream to hook into.
  useStore.subscribe(() => {
    if (canSyncOrgNow()) ensureRealtimeSubscription();
  });
}

export function stopPatientSync(): void {
  unsubscribeStore?.();
  unsubscribeStore = null;
  if (supabase && realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }
  realtimeChannel = null;
  subscribedOrgId = null;
  started = false;
}
