import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { useActivePatient } from "../hooks/useFluidData";
import { Card, CardHeading } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import type { Role, Units } from "../types";
import { format } from "date-fns";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "patient", label: "Patient" },
  { value: "family_carer", label: "Family carer" },
  { value: "nurse", label: "Nurse" },
  { value: "healthcare_assistant", label: "Healthcare assistant" },
  { value: "clinician", label: "Clinician" },
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
  const setUserRole = useStore((s) => s.setUserRole);
  const setAccessibility = useStore((s) => s.setAccessibility);
  const setSaveVoiceTranscripts = useStore((s) => s.setSaveVoiceTranscripts);
  const updatePatient = useStore((s) => s.updatePatient);
  const setAllowance = useStore((s) => s.setAllowance);
  const updateReminder = useStore((s) => s.updateReminder);

  const [allowanceInput, setAllowanceInput] = useState(
    patient?.allowance ? String(patient.allowance.dailyMl) : ""
  );

  if (!patient) return null;

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

      <Card className="p-5">
        <CardHeading>Your role</CardHeading>
        <div className="grid grid-cols-2 gap-2">
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setUserRole(r.value)}
              aria-pressed={currentUser.role === r.value}
              className={`rounded-xl px-3 py-2.5 text-sm font-bold border ${currentUser.role === r.value ? "bg-intake-600 text-white border-intake-600" : "bg-white text-navy-700 border-navy-900/15"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <CardHeading>Voice privacy</CardHeading>
        <p className="text-sm text-fog-600 mb-3">
          Audio is only used to create a transcript and is never permanently
          stored. You can choose whether the text transcript itself is kept
          alongside a saved entry.
        </p>
        <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
          <input
            type="checkbox"
            checked={currentUser.saveVoiceTranscripts}
            onChange={(e) => setSaveVoiceTranscripts(e.target.checked)}
            className="w-5 h-5"
          />
          Save the transcript with voice-created entries
        </label>
      </Card>

      <Card className="p-5">
        <CardHeading>Accessibility</CardHeading>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
            <input
              type="checkbox"
              checked={currentUser.accessibility.largeText}
              onChange={(e) =>
                setAccessibility({ largeText: e.target.checked })
              }
              className="w-5 h-5"
            />
            Large text
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
            <input
              type="checkbox"
              checked={currentUser.accessibility.highContrast}
              onChange={(e) =>
                setAccessibility({ highContrast: e.target.checked })
              }
              className="w-5 h-5"
            />
            High contrast
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
            <input
              type="checkbox"
              checked={currentUser.accessibility.reduceMotion}
              onChange={(e) =>
                setAccessibility({ reduceMotion: e.target.checked })
              }
              className="w-5 h-5"
            />
            Reduce motion
          </label>
        </div>
      </Card>

      <Card className="p-5">
        <CardHeading>Patient details</CardHeading>
        <label className="block text-sm font-semibold text-navy-700">
          Display name
          <input
            defaultValue={patient.displayName}
            onBlur={(e) =>
              updatePatient(patient.id, { displayName: e.target.value })
            }
            className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold text-navy-700 mt-3">
          Care setting
          <input
            defaultValue={patient.careSetting}
            onBlur={(e) =>
              updatePatient(patient.id, { careSetting: e.target.value })
            }
            className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold text-navy-700 mt-3">
          Preferred units
          <select
            defaultValue={patient.units}
            onChange={(e) =>
              updatePatient(patient.id, { units: e.target.value as Units })
            }
            className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal bg-white"
          >
            <option value="mL">mL</option>
            <option value="L">Litres</option>
          </select>
        </label>
        <label className="flex items-center gap-2 mt-3 text-sm font-semibold text-navy-700">
          <input
            type="checkbox"
            defaultChecked={patient.dailyWeightEnabled}
            onChange={(e) =>
              updatePatient(patient.id, {
                dailyWeightEnabled: e.target.checked,
              })
            }
            className="w-5 h-5"
          />
          Track daily weight
        </label>
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
            <input
              inputMode="decimal"
              value={allowanceInput}
              onChange={(e) => setAllowanceInput(e.target.value)}
              placeholder="Daily allowance (mL)"
              className="flex-1 rounded-xl border border-navy-900/15 px-3 py-2.5"
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
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) =>
                    updateReminder(patient.id, r.id, {
                      enabled: e.target.checked,
                    })
                  }
                  className="w-5 h-5"
                />
                Enabled
              </label>
            </li>
          ))}
        </ul>
      </Card>

      {patient.contactInstructions && (
        <Card className="p-5">
          <CardHeading>Healthcare team contact</CardHeading>
          <p className="text-sm text-fog-600">{patient.contactInstructions}</p>
        </Card>
      )}

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
