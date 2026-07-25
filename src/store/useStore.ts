import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuid } from "uuid";
import type {
  AppUser,
  Mode,
  PatientProfile,
  FluidProfile,
  FluidEvent,
  WeightEvent,
  SymptomEvent,
  MedicationEvent,
  DialysisAppointmentEvent,
  SavedContainer,
  EditRecord,
  Reminder,
  FluidAllowance,
  AccessibilityPrefs,
  MonitoringPeriod,
  MonitoringDayStartMode,
  OnboardingInput,
  Sex,
  ClinicalNote,
  VerificationStatus,
} from "../types";
import { generateDemoData } from "../lib/demoData";
import {
  STANDARD_PRESET_CONTAINERS,
  STANDARD_PRESET_FLUIDS,
} from "../lib/standardPresets";

// Persistence is intentionally routed only through this store (never direct
// localStorage access from components) so a real backend such as Supabase can
// later replace the `persist` middleware without touching the UI layer — see
// src/lib/supabase/ for the adapter this is designed to hand off to.

export const DEMO_MODE_ENABLED =
  import.meta.env.VITE_ENABLE_DEMO_MODE !== "false";

interface LiveSnapshot {
  patients: PatientProfile[];
  fluidProfiles: FluidProfile[];
  events: FluidEvent[];
  weightEvents: WeightEvent[];
  symptomEvents: SymptomEvent[];
  medicationEvents: MedicationEvent[];
  dialysisAppointments: DialysisAppointmentEvent[];
  monitoringPeriods: MonitoringPeriod[];
  clinicalNotes: ClinicalNote[];
  activePatientId: string;
}

interface StoreState {
  currentUser: AppUser;
  mode: Mode;
  activePatientId: string;
  patients: PatientProfile[];
  fluidProfiles: FluidProfile[];
  events: FluidEvent[];
  weightEvents: WeightEvent[];
  symptomEvents: SymptomEvent[];
  medicationEvents: MedicationEvent[];
  dialysisAppointments: DialysisAppointmentEvent[];
  monitoringPeriods: MonitoringPeriod[];
  clinicalNotes: ClinicalNote[];

  viewContext: "live" | "demo";
  _liveCache: LiveSnapshot | null;

  // Supabase auth uid for the signed-in account, if any — distinct from
  // currentUser.id (a locally-generated id used before/without cloud auth;
  // see src/lib/supabase/accountSync.ts). Never swapped by enterDemoMode/
  // exitDemoMode, same as currentUser: entering/exiting demo mode has no
  // opinion on cloud sign-in state.
  authUserId: string | null;

  // --- onboarding / account lifecycle ---------------------------------------
  completeOnboarding: (input: OnboardingInput) => void;
  resetAccount: () => void;
  deleteAllFluidData: () => void;

  // --- demo mode --------------------------------------------------------------
  enterDemoMode: () => void;
  exitDemoMode: () => void;

  // --- auth account linking (Supabase) ----------------------------------------
  linkAuthAccount: (authUserId: string) => void;
  unlinkAuthAccount: () => void;

  // --- misc user/session --------------------------------------------------------
  setMode: (mode: Mode) => void;
  setActivePatient: (patientId: string) => void;
  setAccessibility: (changes: Partial<AccessibilityPrefs>) => void;
  setSaveVoiceTranscripts: (save: boolean) => void;
  setCheckInNotificationsEnabled: (enabled: boolean) => void;
  setOrganisation: (organisationId: string, organisationName?: string) => void;

  // --- fluid events ------------------------------------------------------------
  addEvent: (
    e: Omit<FluidEvent, "id" | "recordedTime"> & { recordedTime?: string }
  ) => FluidEvent;
  updateEvent: (
    id: string,
    changes: Partial<FluidEvent>,
    changedBy: string,
    reason?: string
  ) => void;
  deleteEvent: (id: string, changedBy: string, reason?: string) => void;
  deleteEvents: (ids: string[], changedBy: string, reason?: string) => void;
  restoreEvent: (id: string) => void;

  // --- inpatient-mode verification (see VerificationStatus) -----------------------
  // Both route through updateEvent so every status change and field correction
  // lands in the same editHistory audit trail — no parallel history mechanism.
  setEventVerification: (
    id: string,
    status: VerificationStatus,
    verifiedBy: string,
    reason?: string
  ) => void;
  correctEvent: (
    id: string,
    changes: Partial<FluidEvent>,
    correctedBy: string,
    reason?: string
  ) => void;

  // --- clinical notes (home & community mode) -------------------------------------
  addClinicalNote: (
    note: Omit<ClinicalNote, "id" | "time"> & { time?: string }
  ) => ClinicalNote;

  // --- fluid profiles & containers -----------------------------------------------
  addFluidProfile: (fp: Omit<FluidProfile, "id">) => FluidProfile;
  updateFluidProfile: (id: string, changes: Partial<FluidProfile>) => void;
  toggleFavouriteFluid: (patientId: string, fluidProfileId: string) => void;
  addContainer: (
    patientId: string,
    container: Omit<SavedContainer, "id">
  ) => SavedContainer;
  loadStandardPresets: (patientId: string) => void;

  // --- patient profile ------------------------------------------------------------
  addPatient: (displayName: string, careSetting: string) => PatientProfile;
  setAllowance: (patientId: string, allowance: FluidAllowance) => void;
  updatePatient: (patientId: string, changes: Partial<PatientProfile>) => void;

  addWeightEvent: (w: Omit<WeightEvent, "id">) => void;
  addSymptomEvent: (s: Omit<SymptomEvent, "id">) => void;
  addMedicationEvent: (m: Omit<MedicationEvent, "id">) => void;
  addDialysisAppointment: (d: Omit<DialysisAppointmentEvent, "id">) => void;

  addReminder: (patientId: string, reminder: Omit<Reminder, "id">) => void;
  updateReminder: (
    patientId: string,
    reminderId: string,
    changes: Partial<Reminder>
  ) => void;

  // --- monitoring periods / data management ----------------------------------------
  startNewDay: (patientId: string) => MonitoringPeriod;
  getActiveMonitoringPeriod: (patientId: string) => MonitoringPeriod | null;
  setMonitoringDayStart: (
    patientId: string,
    mode: MonitoringDayStartMode,
    customHour?: number
  ) => void;
  clearTodayEntries: (
    patientId: string,
    changedBy: string,
    periodStart: Date,
    periodEnd: Date
  ) => number;
}

const defaultAccessibility: AccessibilityPrefs = {
  largeText: false,
  highContrast: false,
  reduceMotion: false,
};

const emptyUser: AppUser = {
  id: "local-user",
  displayName: "",
  role: "patient",
  mode: "patient",
  accessibility: defaultAccessibility,
  onboardingCompleted: false,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  saveVoiceTranscripts: true,
  checkInNotificationsEnabled: false,
};

const emptyLiveSnapshot: LiveSnapshot = {
  patients: [],
  fluidProfiles: [],
  events: [],
  weightEvents: [],
  symptomEvents: [],
  medicationEvents: [],
  dialysisAppointments: [],
  monitoringPeriods: [],
  clinicalNotes: [],
  activePatientId: "",
};

function newQuickButtons(sex?: Sex) {
  return [
    {
      id: uuid(),
      kind: "intake" as const,
      category: "water" as const,
      label: "Water",
      order: 0,
      enabled: true,
    },
    {
      id: uuid(),
      kind: "intake" as const,
      category: "tea" as const,
      label: "Tea",
      order: 1,
      enabled: true,
    },
    {
      id: uuid(),
      kind: "intake" as const,
      category: "coffee" as const,
      label: "Coffee",
      order: 2,
      enabled: true,
    },
    {
      id: uuid(),
      kind: "intake" as const,
      category: "juice" as const,
      label: "Juice",
      order: 3,
      enabled: true,
    },
    {
      id: uuid(),
      kind: "intake" as const,
      category: "other_intake" as const,
      label: "Other intake",
      order: 4,
      enabled: true,
    },
    {
      id: uuid(),
      kind: "output" as const,
      category: "urine" as const,
      label: "Measured urine",
      order: 5,
      enabled: true,
    },
    {
      id: uuid(),
      kind: "output" as const,
      category: "urine" as const,
      label: "Unmeasured urine",
      order: 6,
      enabled: true,
    },
    {
      id: uuid(),
      kind: "output" as const,
      category: "continence" as const,
      label: "Wet pad (urine)",
      order: 7,
      enabled: true,
    },
    ...(sex === "female"
      ? [
          {
            id: uuid(),
            kind: "output" as const,
            category: "menstrual_pad" as const,
            label: "Menstrual pad",
            order: 7.5,
            enabled: true,
          },
        ]
      : []),
    {
      id: uuid(),
      kind: "output" as const,
      category: "vomit" as const,
      label: "Vomiting",
      order: 8,
      enabled: true,
    },
    {
      id: uuid(),
      kind: "output" as const,
      category: "other_output" as const,
      label: "Other output",
      order: 9,
      enabled: true,
    },
  ];
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      currentUser: emptyUser,
      mode: "patient",
      activePatientId: "",
      patients: [],
      fluidProfiles: [],
      events: [],
      weightEvents: [],
      symptomEvents: [],
      medicationEvents: [],
      dialysisAppointments: [],
      monitoringPeriods: [],
      clinicalNotes: [],

      viewContext: "live",
      _liveCache: null,
      authUserId: null,

      completeOnboarding: (input) => {
        const now = new Date().toISOString();
        const isHealthcare = input.accountMode === "healthcare";

        // A healthcare account manages a caseload it doesn't have yet — start
        // with zero patients and land in the dashboard's "add patient" flow,
        // rather than fabricating a placeholder patient record that reads as
        // real data. Patient accounts still get their own profile immediately.
        let profile: PatientProfile | null = null;
        let period: MonitoringPeriod | null = null;

        if (!isHealthcare) {
          const profileId = uuid();
          const periodId = uuid();
          profile = {
            id: profileId,
            displayName: input.displayName || "Me",
            careSetting: input.careSetting?.trim() || "Home monitoring",
            sex: input.sex,
            monitoringDayStartMode: "midnight",
            units: input.units,
            favouriteFluidIds: [],
            containers: [],
            quickButtons: newQuickButtons(input.sex),
            dailyWeightEnabled: input.dailyWeightEnabled ?? false,
            careTeamShareConsent: input.careTeamShareConsent ?? false,
            organisationId: input.organisationId,
            reminders: [
              {
                id: uuid(),
                kind: "record_drink",
                enabled: false,
                intervalHours: 6,
              },
              {
                id: uuid(),
                kind: "record_output",
                enabled: false,
                intervalHours: 6,
              },
              { id: uuid(), kind: "daily_weight", enabled: false },
              { id: uuid(), kind: "evening_review", enabled: false },
            ],
            allowance:
              input.wantsAllowanceTracking && input.allowanceMl
                ? {
                    dailyMl: input.allowanceMl,
                    setByName: input.displayName,
                    setByRole: input.role,
                    setAt: now,
                  }
                : undefined,
            activeMonitoringPeriodId: periodId,
          };

          period = {
            id: periodId,
            profileId,
            startTime: now,
            endTime: null,
            type: "manual",
            status: "active",
            createdBy: input.displayName,
          };
        }

        set({
          currentUser: {
            id: uuid(),
            displayName: input.displayName,
            role: input.role,
            mode: input.accountMode,
            accessibility: { ...defaultAccessibility, ...input.accessibility },
            onboardingCompleted: true,
            timezone: input.timezone,
            saveVoiceTranscripts: input.saveVoiceTranscripts ?? true,
            checkInNotificationsEnabled: false,
            organisationName: isHealthcare ? input.organisationName : undefined,
          },
          mode: input.accountMode,
          patients: profile ? [profile] : [],
          fluidProfiles: [],
          events: [],
          weightEvents: [],
          symptomEvents: [],
          medicationEvents: [],
          dialysisAppointments: [],
          monitoringPeriods: period ? [period] : [],
          activePatientId: profile ? profile.id : "",
          viewContext: "live",
          _liveCache: null,
        });
      },

      resetAccount: () =>
        set({
          currentUser: { ...emptyUser, id: uuid() },
          mode: "patient",
          ...emptyLiveSnapshot,
          viewContext: "live",
          _liveCache: null,
          authUserId: null,
        }),

      deleteAllFluidData: () =>
        set({
          events: [],
          weightEvents: [],
          symptomEvents: [],
          medicationEvents: [],
          dialysisAppointments: [],
        }),

      enterDemoMode: () => {
        if (!DEMO_MODE_ENABLED) return;
        const s = get();
        if (s.viewContext === "demo") return;
        const demo = generateDemoData(new Date());
        set({
          viewContext: "demo",
          _liveCache: {
            patients: s.patients,
            fluidProfiles: s.fluidProfiles,
            events: s.events,
            weightEvents: s.weightEvents,
            symptomEvents: s.symptomEvents,
            medicationEvents: s.medicationEvents,
            dialysisAppointments: s.dialysisAppointments,
            monitoringPeriods: s.monitoringPeriods,
            clinicalNotes: s.clinicalNotes,
            activePatientId: s.activePatientId,
          },
          patients: demo.patients,
          fluidProfiles: demo.fluidProfiles,
          events: demo.events,
          weightEvents: demo.weightEvents,
          symptomEvents: [],
          medicationEvents: [],
          dialysisAppointments: [],
          monitoringPeriods: demo.monitoringPeriods,
          clinicalNotes: [],
          activePatientId: demo.patients[demo.patients.length - 1].id,
          mode: "patient",
        });
      },

      exitDemoMode: () => {
        const s = get();
        if (s.viewContext !== "demo") return;
        const cache = s._liveCache ?? emptyLiveSnapshot;
        set({
          viewContext: "live",
          _liveCache: null,
          ...cache,
          mode: s.currentUser.mode,
        });
      },

      linkAuthAccount: (authUserId) => {
        const s = get();
        if (s.authUserId === authUserId) return;
        set({ authUserId });
      },

      unlinkAuthAccount: () => {
        const s = get();
        if (s.authUserId === null) return;
        set({ authUserId: null });
      },

      setMode: (mode) => {
        const state = get();
        set({
          mode,
          currentUser: { ...state.currentUser, mode },
        });
      },

      setActivePatient: (patientId) => set({ activePatientId: patientId }),

      setAccessibility: (changes) =>
        set((s) => ({
          currentUser: {
            ...s.currentUser,
            accessibility: { ...s.currentUser.accessibility, ...changes },
          },
        })),

      setSaveVoiceTranscripts: (save) =>
        set((s) => ({
          currentUser: { ...s.currentUser, saveVoiceTranscripts: save },
        })),

      setCheckInNotificationsEnabled: (enabled) =>
        set((s) => ({
          currentUser: {
            ...s.currentUser,
            checkInNotificationsEnabled: enabled,
          },
        })),

      setOrganisation: (organisationId, organisationName) =>
        set((s) => ({
          currentUser: {
            ...s.currentUser,
            organisationId,
            ...(organisationName !== undefined ? { organisationName } : {}),
          },
        })),

      addEvent: (e) => {
        const event: FluidEvent = {
          ...e,
          id: uuid(),
          recordedTime: e.recordedTime ?? new Date().toISOString(),
        };
        set((s) => ({ events: [event, ...s.events] }));
        return event;
      },

      updateEvent: (id, changes, changedBy, reason) =>
        set((s) => ({
          events: s.events.map((ev) => {
            if (ev.id !== id) return ev;
            const editHistory: EditRecord[] = [...(ev.editHistory ?? [])];
            for (const key of Object.keys(changes) as (keyof FluidEvent)[]) {
              if (changes[key] !== undefined && changes[key] !== ev[key]) {
                editHistory.push({
                  time: new Date().toISOString(),
                  field: String(key),
                  originalValue: String(ev[key] ?? ""),
                  updatedValue: String(changes[key]),
                  changedBy,
                  reason,
                });
              }
            }
            return { ...ev, ...changes, edited: true, editHistory };
          }),
        })),

      deleteEvent: (id, changedBy, reason) =>
        get().deleteEvents([id], changedBy, reason),

      deleteEvents: (ids, changedBy, reason) => {
        const idSet = new Set(ids);
        const now = new Date().toISOString();
        set((s) => ({
          events: s.events.map((ev) =>
            idSet.has(ev.id)
              ? {
                  ...ev,
                  deleted: true,
                  deletedAt: now,
                  edited: true,
                  editHistory: [
                    ...(ev.editHistory ?? []),
                    {
                      time: now,
                      field: "deleted",
                      originalValue: "false",
                      updatedValue: "true",
                      changedBy,
                      reason,
                    },
                  ],
                }
              : ev
          ),
        }));
      },

      restoreEvent: (id) =>
        set((s) => ({
          events: s.events.map((ev) =>
            ev.id === id ? { ...ev, deleted: false, deletedAt: undefined } : ev
          ),
        })),

      setEventVerification: (id, status, verifiedBy, reason) =>
        get().updateEvent(
          id,
          {
            verificationStatus: status,
            verifiedBy,
            verifiedAt: new Date().toISOString(),
          },
          verifiedBy,
          reason
        ),

      correctEvent: (id, changes, correctedBy, reason) =>
        get().updateEvent(
          id,
          {
            ...changes,
            verificationStatus: "corrected",
            verifiedBy: correctedBy,
            verifiedAt: new Date().toISOString(),
          },
          correctedBy,
          reason
        ),

      addClinicalNote: (n) => {
        const note: ClinicalNote = {
          ...n,
          id: uuid(),
          time: n.time ?? new Date().toISOString(),
        };
        set((s) => ({ clinicalNotes: [note, ...s.clinicalNotes] }));
        return note;
      },

      addFluidProfile: (fp) => {
        const profile: FluidProfile = { ...fp, id: uuid() };
        set((s) => ({ fluidProfiles: [...s.fluidProfiles, profile] }));
        return profile;
      },

      updateFluidProfile: (id, changes) =>
        set((s) => ({
          fluidProfiles: s.fluidProfiles.map((fp) =>
            fp.id === id ? { ...fp, ...changes } : fp
          ),
        })),

      toggleFavouriteFluid: (patientId, fluidProfileId) =>
        set((s) => ({
          patients: s.patients.map((p) => {
            if (p.id !== patientId) return p;
            const has = p.favouriteFluidIds.includes(fluidProfileId);
            return {
              ...p,
              favouriteFluidIds: has
                ? p.favouriteFluidIds.filter((id) => id !== fluidProfileId)
                : [...p.favouriteFluidIds, fluidProfileId],
            };
          }),
        })),

      addContainer: (patientId, container) => {
        const c: SavedContainer = { ...container, id: uuid() };
        set((s) => ({
          patients: s.patients.map((p) =>
            p.id === patientId ? { ...p, containers: [...p.containers, c] } : p
          ),
        }));
        return c;
      },

      loadStandardPresets: (patientId) => {
        const newContainers: SavedContainer[] = STANDARD_PRESET_CONTAINERS.map(
          (c) => ({ ...c, id: uuid() })
        );
        const newProfiles: FluidProfile[] = STANDARD_PRESET_FLUIDS.map((f) => ({
          ...f,
          id: uuid(),
        }));
        const newProfileIds = newProfiles.map((fp) => fp.id);

        set((s) => ({
          fluidProfiles: [...s.fluidProfiles, ...newProfiles],
          patients: s.patients.map((p) =>
            p.id === patientId
              ? {
                  ...p,
                  containers: [...p.containers, ...newContainers],
                  favouriteFluidIds: Array.from(
                    new Set([...p.favouriteFluidIds, ...newProfileIds])
                  ),
                }
              : p
          ),
        }));
      },

      addPatient: (displayName, careSetting) => {
        const now = new Date().toISOString();
        const profileId = uuid();
        const periodId = uuid();
        const organisationId = get().currentUser.organisationId;
        const profile: PatientProfile = {
          id: profileId,
          displayName,
          careSetting,
          organisationId: organisationId || undefined,
          monitoringDayStartMode: "midnight",
          units:
            get().currentUser.mode === "healthcare"
              ? "mL"
              : (get().patients[0]?.units ?? "mL"),
          favouriteFluidIds: [],
          containers: [],
          quickButtons: newQuickButtons(),
          dailyWeightEnabled: false,
          reminders: [],
          activeMonitoringPeriodId: periodId,
        };
        const period: MonitoringPeriod = {
          id: periodId,
          profileId,
          startTime: now,
          endTime: null,
          type: "manual",
          status: "active",
          createdBy: get().currentUser.displayName,
        };
        set((s) => ({
          patients: [...s.patients, profile],
          monitoringPeriods: [...s.monitoringPeriods, period],
          activePatientId: profileId,
        }));
        return profile;
      },

      setAllowance: (patientId, allowance) =>
        set((s) => ({
          patients: s.patients.map((p) =>
            p.id === patientId ? { ...p, allowance } : p
          ),
        })),

      updatePatient: (patientId, changes) =>
        set((s) => ({
          patients: s.patients.map((p) =>
            p.id === patientId ? { ...p, ...changes } : p
          ),
        })),

      addWeightEvent: (w) =>
        set((s) => ({
          weightEvents: [{ ...w, id: uuid() }, ...s.weightEvents],
        })),
      addSymptomEvent: (sy) =>
        set((s) => ({
          symptomEvents: [{ ...sy, id: uuid() }, ...s.symptomEvents],
        })),
      addMedicationEvent: (m) =>
        set((s) => ({
          medicationEvents: [{ ...m, id: uuid() }, ...s.medicationEvents],
        })),
      addDialysisAppointment: (d) =>
        set((s) => ({
          dialysisAppointments: [
            { ...d, id: uuid() },
            ...s.dialysisAppointments,
          ],
        })),

      addReminder: (patientId, reminder) =>
        set((s) => ({
          patients: s.patients.map((p) =>
            p.id === patientId
              ? {
                  ...p,
                  reminders: [...p.reminders, { ...reminder, id: uuid() }],
                }
              : p
          ),
        })),

      updateReminder: (patientId, reminderId, changes) =>
        set((s) => ({
          patients: s.patients.map((p) =>
            p.id !== patientId
              ? p
              : {
                  ...p,
                  reminders: p.reminders.map((r) =>
                    r.id === reminderId ? { ...r, ...changes } : r
                  ),
                }
          ),
        })),

      startNewDay: (patientId) => {
        const now = new Date().toISOString();
        const newPeriod: MonitoringPeriod = {
          id: uuid(),
          profileId: patientId,
          startTime: now,
          endTime: null,
          type: "manual",
          status: "active",
          createdBy: get().currentUser.displayName,
        };
        set((s) => ({
          monitoringPeriods: [
            ...s.monitoringPeriods.map((mp) =>
              mp.profileId === patientId && mp.status === "active"
                ? { ...mp, status: "closed" as const, endTime: now }
                : mp
            ),
            newPeriod,
          ],
          patients: s.patients.map((p) =>
            p.id === patientId
              ? { ...p, activeMonitoringPeriodId: newPeriod.id }
              : p
          ),
        }));
        return newPeriod;
      },

      getActiveMonitoringPeriod: (patientId) => {
        const s = get();
        return (
          s.monitoringPeriods.find(
            (mp) => mp.profileId === patientId && mp.status === "active"
          ) ?? null
        );
      },

      setMonitoringDayStart: (patientId, mode, customHour) =>
        set((s) => ({
          patients: s.patients.map((p) =>
            p.id === patientId
              ? {
                  ...p,
                  monitoringDayStartMode: mode,
                  monitoringDayCustomHour: customHour,
                }
              : p
          ),
        })),

      clearTodayEntries: (patientId, changedBy, periodStart, periodEnd) => {
        const s = get();
        const toDelete = s.events.filter(
          (e) =>
            !e.deleted &&
            e.patientId === patientId &&
            new Date(e.eventTime) >= periodStart &&
            new Date(e.eventTime) <= periodEnd
        );
        if (toDelete.length > 0) {
          s.deleteEvents(
            toDelete.map((e) => e.id),
            changedBy,
            "Cleared current monitoring day"
          );
        }
        return toDelete.length;
      },
    }),
    {
      name: "fluidsense-store-v2",
      partialize: (state) => {
        const live =
          state.viewContext === "demo" && state._liveCache
            ? state._liveCache
            : {
                patients: state.patients,
                fluidProfiles: state.fluidProfiles,
                events: state.events,
                weightEvents: state.weightEvents,
                symptomEvents: state.symptomEvents,
                medicationEvents: state.medicationEvents,
                dialysisAppointments: state.dialysisAppointments,
                monitoringPeriods: state.monitoringPeriods,
                clinicalNotes: state.clinicalNotes,
                activePatientId: state.activePatientId,
              };
        return {
          currentUser: state.currentUser,
          mode: state.mode,
          authUserId: state.authUserId,
          ...live,
        };
      },
    }
  )
);
