import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { v4 as uuid } from "uuid";
import { useStore } from "../store/useStore";
import { useAuthStore } from "../store/useAuthStore";
import { useActivePatient } from "../hooks/useFluidData";
import { Card, CardHeading } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import { Field, Input } from "../components/ui/Field";
import { Switch } from "../components/ui/Checkbox";
import { SignOutButton } from "../components/auth";
import { WorkspaceSetup } from "../components/onboarding/WorkspaceSetup";
import { PatientClinicSharingCard } from "../components/profile/PatientClinicSharingCard";
import type { DeploymentMode, Role, Units } from "../types";
import { format } from "date-fns";
import { enableCheckInPush, disableCheckInPush } from "../lib/push/subscribe";
import {
  getMyOrganisation,
  createOrganisationInvite,
  listOrganisationMembers,
  type OrganisationMemberRow,
} from "../lib/supabase/organisations";

/**
 * Team roster + invite-code generation for a healthcare account that's
 * already in a workspace, or the create/join flow for one that isn't yet.
 * Rendered both from the main profile body (once a patient exists) and from
 * the no-patient-yet fallback below — workspace setup shouldn't be blocked
 * on having added a patient first.
 */
function TeamWorkspaceSection() {
  const currentUser = useStore((s) => s.currentUser);
  const setOrganisation = useStore((s) => s.setOrganisation);
  const authStatus = useAuthStore((s) => s.status);
  const [members, setMembers] = useState<OrganisationMemberRow[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedRemote, setCheckedRemote] = useState(false);

  const organisationId = currentUser.organisationId;

  // Recovers workspace membership on a fresh device/browser where local
  // state doesn't have it yet but the account's public.users row does (the
  // membership itself lives entirely server-side).
  useEffect(() => {
    if (organisationId || authStatus !== "signed-in" || checkedRemote) return;
    setCheckedRemote(true);
    void getMyOrganisation().then((result) => {
      if (result.organisationId) {
        setOrganisation(
          result.organisationId,
          result.organisationName ?? undefined
        );
      }
    });
  }, [organisationId, authStatus, checkedRemote, setOrganisation]);

  useEffect(() => {
    if (!organisationId) return;
    void listOrganisationMembers(organisationId).then((result) => {
      if (!result.error) setMembers(result.members);
    });
  }, [organisationId]);

  if (authStatus !== "signed-in") {
    return (
      <Card className="p-5">
        <CardHeading>Team workspace</CardHeading>
        <p className="text-sm text-fog-600">
          Sign in to create or join your team's shared workspace.
        </p>
      </Card>
    );
  }

  if (!organisationId) {
    return (
      <WorkspaceSetup
        role={currentUser.role}
        onJoined={(id, name) => setOrganisation(id, name ?? undefined)}
      />
    );
  }

  const generateInvite = async () => {
    setBusy(true);
    setError(null);
    const result = await createOrganisationInvite(organisationId);
    setBusy(false);
    if (result.error || !result.code) {
      setError(result.error?.message ?? "Couldn't generate an invite code.");
      return;
    }
    setInviteCode(result.code);
  };

  return (
    <Card className="p-5 space-y-3">
      <CardHeading>Team workspace</CardHeading>
      {currentUser.organisationName && (
        <p className="text-sm text-navy-800 font-semibold">
          {currentUser.organisationName}
        </p>
      )}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-fog-500 mb-1.5">
          Staff
        </p>
        <ul className="space-y-1.5">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-xl bg-fog-50 px-3 py-2 text-sm"
            >
              <span className="font-semibold text-navy-800">
                {m.displayName || "Team member"}
              </span>
              <span className="text-fog-500">{m.role.replace("_", " ")}</span>
            </li>
          ))}
        </ul>
      </div>
      {inviteCode ? (
        <div className="rounded-xl bg-intake-50 border border-intake-200 p-3">
          <p className="text-xs text-fog-600 mb-1">
            Share this code with a colleague to add them to this workspace:
          </p>
          <p className="text-lg font-extrabold text-navy-900 tracking-wide">
            {inviteCode}
          </p>
        </div>
      ) : (
        <Button variant="secondary" onClick={generateInvite} disabled={busy}>
          {busy ? "Generating…" : "Invite a colleague"}
        </Button>
      )}
      {error && <p className="text-xs text-alert-600">{error}</p>}
    </Card>
  );
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "patient", label: "Patient" },
  { value: "family_carer", label: "Family carer" },
  { value: "nurse", label: "Nurse" },
  { value: "healthcare_assistant", label: "Healthcare assistant" },
  { value: "clinician", label: "Clinician" },
];

const UNITS_OPTIONS: { value: Units; label: string }[] = [
  { value: "mL", label: "mL" },
  { value: "L", label: "Litres" },
];

const LOCATION_OPTIONS: { value: DeploymentMode; label: string }[] = [
  { value: "home_community", label: "At home" },
  { value: "inpatient", label: "Checked in to hospital" },
];

const REMINDER_LABELS: Record<string, string> = {
  record_drink: "Record a drink",
  record_output: "Record urine or output",
  daily_weight: "Enter daily weight",
  evening_review: "Complete an evening review",
  check_forgotten: "Check whether an event was forgotten",
};

export function ProfilePage() {
  const navigate = useNavigate();
  const patient = useActivePatient();
  const mode = useStore((s) => s.mode);
  const viewContext = useStore((s) => s.viewContext);
  const exitDemoMode = useStore((s) => s.exitDemoMode);
  const currentUser = useStore((s) => s.currentUser);
  const setAccessibility = useStore((s) => s.setAccessibility);
  const setSaveVoiceTranscripts = useStore((s) => s.setSaveVoiceTranscripts);
  const setCheckInNotificationsEnabled = useStore(
    (s) => s.setCheckInNotificationsEnabled
  );
  const updatePatient = useStore((s) => s.updatePatient);
  const setAllowance = useStore((s) => s.setAllowance);
  const updateReminder = useStore((s) => s.updateReminder);
  const unlinkAuthAccount = useStore((s) => s.unlinkAuthAccount);
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);

  const [allowanceInput, setAllowanceInput] = useState(
    patient?.allowance ? String(patient.allowance.dailyMl) : ""
  );
  const [checkInPending, setCheckInPending] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);
  const [contactNameInput, setContactNameInput] = useState("");
  const [contactEmailInput, setContactEmailInput] = useState("");

  if (!patient) {
    // Healthcare accounts start with zero patients (see TodayPage's own
    // redirect for the same reason) — workspace setup shouldn't be blocked
    // on adding a patient first, so this gets a minimal standalone view
    // instead of the blanket `return null` patient-mode falls back to.
    if (mode === "healthcare") {
      return (
        <div className="max-w-lg mx-auto space-y-4 pb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-900">Profile</h1>
            <p className="text-sm text-fog-600">
              Set up your team workspace, then{" "}
              <Link to="/dashboard" className="text-intake-600 font-semibold">
                add your first patient
              </Link>
              .
            </p>
          </div>
          <TeamWorkspaceSection />
        </div>
      );
    }
    return null;
  }

  const handleCheckInToggle = async (enabled: boolean) => {
    setCheckInMessage(null);
    if (!enabled) {
      setCheckInNotificationsEnabled(false);
      setCheckInPending(true);
      await disableCheckInPush();
      setCheckInPending(false);
      return;
    }
    setCheckInPending(true);
    const result = await enableCheckInPush(patient.id);
    setCheckInPending(false);
    setCheckInNotificationsEnabled(result.ok);
    if (!result.ok && result.message) {
      setCheckInMessage(result.message);
    }
  };

  const handleAddCareTeamContact = () => {
    const name = contactNameInput.trim();
    const email = contactEmailInput.trim();
    if (!name || !email.includes("@")) return;
    const newContact = { id: uuid(), name, email };
    updatePatient(patient.id, {
      careTeamContacts: [...(patient.careTeamContacts ?? []), newContact],
    });
    setContactNameInput("");
    setContactEmailInput("");
  };

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Profile</h1>
        <p className="text-sm text-fog-600">
          {viewContext === "demo"
            ? "Exploring demo mode — fictional data, changes here do not affect your real account."
            : "Manage your account, reminders and preferences."}
        </p>
      </div>

      {mode === "healthcare" && viewContext === "live" && (
        <TeamWorkspaceSection />
      )}

      {mode === "patient" && viewContext === "live" && (
        <PatientClinicSharingCard />
      )}

      {viewContext === "demo" && (
        <Card className="p-5 border-2 border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800 mb-2">
            You're viewing demo mode.
          </p>
          <Button
            size="md"
            onClick={() => {
              exitDemoMode();
              navigate("/");
            }}
          >
            Exit demo mode
          </Button>
        </Card>
      )}

      {viewContext === "live" && (
        <Card className="p-5">
          <CardHeading>Account</CardHeading>
          {authStatus === "signed-in" && authUser ? (
            <>
              <p className="text-sm text-fog-600 mb-3">
                Signed in as{" "}
                <span className="font-semibold text-navy-800">
                  {authUser.email}
                </span>
                . Your data stays on this device either way — signing out only
                stops cloud sync, it never deletes or blocks access to local
                data.
              </p>
              <SignOutButton onSignOut={() => unlinkAuthAccount()} />
            </>
          ) : (
            <p className="text-sm text-fog-600">
              Not signed in. FluidSense works fully on this device without an
              account.
            </p>
          )}
        </Card>
      )}

      <Card className="p-5">
        <CardHeading>Your role</CardHeading>
        <p className="text-sm font-semibold text-navy-800">
          {ROLE_OPTIONS.find((r) => r.value === currentUser.role)?.label ??
            currentUser.role}
        </p>
        <p className="text-xs text-fog-500 mt-1">Set when you signed up.</p>
      </Card>

      <Card className="p-5">
        <CardHeading>Voice privacy</CardHeading>
        <p className="text-sm text-fog-600 mb-3">
          Audio is only used to create a transcript and is never permanently
          stored. You can choose whether the text transcript itself is kept
          alongside a saved entry.
        </p>
        <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
          <Switch
            checked={currentUser.saveVoiceTranscripts}
            onChange={(e) => setSaveVoiceTranscripts(e.target.checked)}
          />
          Save the transcript with voice-created entries
        </label>
      </Card>

      <Card className="p-5">
        <CardHeading>Accessibility</CardHeading>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
            <Switch
              checked={currentUser.accessibility.largeText}
              onChange={(e) =>
                setAccessibility({ largeText: e.target.checked })
              }
            />
            Large text
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
            <Switch
              checked={currentUser.accessibility.highContrast}
              onChange={(e) =>
                setAccessibility({ highContrast: e.target.checked })
              }
            />
            High contrast
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
            <Switch
              checked={currentUser.accessibility.reduceMotion}
              onChange={(e) =>
                setAccessibility({ reduceMotion: e.target.checked })
              }
            />
            Reduce motion
          </label>
        </div>
      </Card>

      <Card className="p-5">
        <CardHeading>Patient details</CardHeading>
        <Field label="Display name">
          <Input
            defaultValue={patient.displayName}
            onBlur={(e) =>
              updatePatient(patient.id, { displayName: e.target.value })
            }
          />
        </Field>
        <Field label="Care setting" className="mt-3">
          <Input
            defaultValue={patient.careSetting}
            onBlur={(e) =>
              updatePatient(patient.id, { careSetting: e.target.value })
            }
          />
        </Field>
        <div className="mt-3">
          <p className="text-sm font-semibold text-navy-700 mb-1.5">
            Preferred units
          </p>
          <SegmentedTabs
            label="Preferred units"
            value={patient.units}
            onChange={(units: Units) => updatePatient(patient.id, { units })}
            options={UNITS_OPTIONS}
          />
        </div>
        <label className="flex items-center gap-2 mt-3 text-sm font-semibold text-navy-700">
          <Switch
            defaultChecked={patient.dailyWeightEnabled}
            onChange={(e) =>
              updatePatient(patient.id, {
                dailyWeightEnabled: e.target.checked,
              })
            }
          />
          Track daily weight
        </label>
      </Card>

      <Card className="p-5">
        <CardHeading>Location</CardHeading>
        <p className="text-sm text-fog-600 mb-3">
          Lets your care team know whether you're recording from home or
          currently admitted.
        </p>
        <SegmentedTabs
          label="Location"
          value={patient.deploymentMode ?? "home_community"}
          onChange={(deploymentMode: DeploymentMode) =>
            updatePatient(patient.id, { deploymentMode })
          }
          options={LOCATION_OPTIONS}
        />
      </Card>

      <Card className="p-5">
        <CardHeading>Fluid allowance</CardHeading>
        {patient.allowance ? (
          <p className="text-xs text-fog-500 mb-2">
            Currently set to {patient.allowance.dailyMl} mL by{" "}
            {patient.allowance.setByName} on{" "}
            {format(new Date(patient.allowance.setAt), "d MMM yyyy")}.
          </p>
        ) : (
          <p className="text-xs text-fog-500 mb-2">
            No allowance set.{" "}
            {mode === "patient"
              ? "This is usually set by the healthcare team."
              : ""}
          </p>
        )}
        {mode === "healthcare" ? (
          <div className="flex gap-2">
            <Input
              inputMode="decimal"
              value={allowanceInput}
              onChange={(e) => setAllowanceInput(e.target.value)}
              placeholder="Daily allowance (mL)"
              className="flex-1"
            />
            <Button
              size="md"
              disabled={!allowanceInput}
              onClick={() =>
                setAllowance(patient.id, {
                  dailyMl: parseFloat(allowanceInput),
                  setByName: currentUser.displayName,
                  setByRole: currentUser.role,
                  setAt: new Date().toISOString(),
                })
              }
            >
              Set
            </Button>
          </div>
        ) : (
          <p className="text-sm text-fog-600">
            Fluid allowances are set by the healthcare team, not the patient.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <CardHeading>Reminders</CardHeading>
        <p className="text-sm text-fog-600 mb-3">
          Gentle nudges — never assumes a missing entry means nothing happened.
        </p>
        <ul className="space-y-2">
          {patient.reminders.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-xl bg-fog-50 px-3 py-2.5"
            >
              <span className="text-sm font-semibold text-navy-800">
                {REMINDER_LABELS[r.kind] ?? r.kind}
              </span>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={r.enabled}
                  onChange={(e) =>
                    updateReminder(patient.id, r.id, {
                      enabled: e.target.checked,
                    })
                  }
                />
                Enabled
              </label>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <CardHeading>Care team sharing</CardHeading>
        <p className="text-sm text-fog-600 mb-3">
          Choose who can receive a copy of your recorded fluid summary. Nothing
          is sent unless you turn this on and add at least one contact.
        </p>
        <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
          <Switch
            checked={patient.careTeamShareConsent ?? false}
            onChange={(e) =>
              updatePatient(patient.id, {
                careTeamShareConsent: e.target.checked,
              })
            }
          />
          Allow sharing my summary with the contacts below
        </label>

        <div
          className={patient.careTeamShareConsent ? "mt-4" : "mt-4 opacity-60"}
        >
          {(patient.careTeamContacts ?? []).length > 0 && (
            <ul className="space-y-2 mb-3">
              {(patient.careTeamContacts ?? []).map((contact) => (
                <li
                  key={contact.id}
                  className="flex items-center justify-between rounded-xl bg-fog-50 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-navy-800">
                      {contact.name}
                    </p>
                    <p className="text-xs text-fog-500">{contact.email}</p>
                  </div>
                  <button
                    onClick={() =>
                      updatePatient(patient.id, {
                        careTeamContacts: (
                          patient.careTeamContacts ?? []
                        ).filter((c) => c.id !== contact.id),
                      })
                    }
                    className="text-sm font-bold text-navy-500 hover:text-navy-700"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={contactNameInput}
              onChange={(e) => setContactNameInput(e.target.value)}
              placeholder="Contact name"
              className="flex-1"
            />
            <Input
              value={contactEmailInput}
              onChange={(e) => setContactEmailInput(e.target.value)}
              placeholder="Contact email"
              className="flex-1"
            />
            <Button
              size="md"
              disabled={
                !contactNameInput.trim() || !contactEmailInput.includes("@")
              }
              onClick={handleAddCareTeamContact}
            >
              Add
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <CardHeading>Check-in reminders</CardHeading>
        <p className="text-sm text-fog-600 mb-3">
          Get a reminder if you haven't logged anything in the morning,
          afternoon, or evening window.
        </p>
        <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
          <Switch
            checked={currentUser.checkInNotificationsEnabled}
            disabled={checkInPending}
            onChange={(e) => {
              void handleCheckInToggle(e.target.checked);
            }}
          />
          Check-in reminders
        </label>
        {checkInMessage && (
          <p className="text-xs text-fog-500 mt-2">{checkInMessage}</p>
        )}
      </Card>

      {patient.contactInstructions && (
        <Card className="p-5">
          <CardHeading>Healthcare team contact</CardHeading>
          <p className="text-sm text-fog-600">{patient.contactInstructions}</p>
        </Card>
      )}

      <Card className="p-5">
        <CardHeading>Medications &amp; dialysis</CardHeading>
        <p className="text-sm text-fog-600 mb-3">
          Log diuretic or other medications, and renal replacement therapy /
          dialysis appointments and attendance.
        </p>
        <Button variant="secondary" onClick={() => navigate("/care-log")}>
          Open medications &amp; dialysis log
        </Button>
      </Card>

      <Card className="p-5">
        <CardHeading>Data and monitoring settings</CardHeading>
        <p className="text-sm text-fog-600 mb-3">
          Start a new day, clear entries, or permanently delete data.
        </p>
        <Button variant="secondary" onClick={() => navigate("/settings/data")}>
          Open data settings
        </Button>
      </Card>

      <Card className="p-5 bg-fog-100">
        <p className="text-sm text-fog-600">
          FluidSense is a prototype. Your data is stored on this device and does
          not connect to real clinical systems.
        </p>
        <p className="text-xs text-fog-500 mt-2">
          <Link to="/privacy" className="underline hover:no-underline">
            Privacy
          </Link>
          {" · "}
          <Link to="/terms" className="underline hover:no-underline">
            Terms
          </Link>
        </p>
      </Card>
    </div>
  );
}
