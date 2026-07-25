import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useStore } from "../../store/useStore";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PrototypeBanner } from "../../components/ui/PrototypeBanner";
import { SegmentedTabs } from "../../components/ui/SegmentedTabs";
import { EmailPasswordForm, MagicLinkForm } from "../../components/auth";
import type { Mode, Role, Units } from "../../types";

const UNITS_OPTIONS: { value: Units; label: string }[] = [
  { value: "mL", label: "mL" },
  { value: "L", label: "Litres" },
];

const PATIENT_ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "patient", label: "Myself" },
  { value: "family_carer", label: "Someone else" },
];

const COMMON_TIMEZONES = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Australia/Perth",
  "Pacific/Auckland",
  "UTC",
];

function timezoneOptions(detected: string): string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (supported?.length) return supported;
  } catch {
    // fall through to curated list
  }
  return Array.from(new Set([detected, ...COMMON_TIMEZONES]));
}

const HEALTHCARE_ROLES: Role[] = ["nurse", "healthcare_assistant", "clinician"];
const HEALTHCARE_ROLE_OPTIONS: { value: Role; label: string }[] =
  HEALTHCARE_ROLES.map((r) => ({ value: r, label: r.replace("_", " ") }));

export function OnboardingFlow() {
  const navigate = useNavigate();
  const onboardingCompleted = useStore(
    (s) => s.currentUser.onboardingCompleted
  );
  const completeOnboarding = useStore((s) => s.completeOnboarding);

  const detectedTz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );
  const [step, setStep] = useState(1);
  const [accountMode, setAccountMode] = useState<Mode | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("patient");
  const [units, setUnits] = useState<Units>("mL");
  const [timezone, setTimezone] = useState(detectedTz);
  const [wantsAllowance, setWantsAllowance] = useState(false);
  const [allowanceMl, setAllowanceMl] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [isTestWorkspace, setIsTestWorkspace] = useState(true);
  const [showSignUp, setShowSignUp] = useState(false);
  const [signUpUseMagicLink, setSignUpUseMagicLink] = useState(false);
  const [signUpDone, setSignUpDone] = useState(false);

  if (onboardingCompleted) return <Navigate to="/" replace />;

  const tzOptions = timezoneOptions(detectedTz);

  const finish = () => {
    completeOnboarding({
      accountMode: accountMode ?? "patient",
      displayName:
        displayName.trim() ||
        (accountMode === "healthcare" ? "Staff member" : "Me"),
      role:
        accountMode === "healthcare"
          ? role
          : role === "patient" || role === "family_carer"
            ? role
            : "patient",
      units,
      timezone,
      wantsAllowanceTracking: wantsAllowance,
      allowanceMl: allowanceMl ? parseFloat(allowanceMl) : undefined,
      organisationName: organisationName || undefined,
      isTestWorkspace,
    });
    navigate("/");
  };

  return (
    <div className="min-h-dvh flex flex-col bg-fog-50">
      <PrototypeBanner />
      <div className="flex-1 px-6 py-8 max-w-md mx-auto w-full">
        <p className="text-xs font-bold uppercase tracking-wide text-fog-500 mb-1">
          Step {step} of 3
        </p>
        <h1 className="text-2xl font-extrabold text-navy-900 mb-6">
          {step === 1
            ? "How will you use FluidSense?"
            : step === 2
              ? "A few details"
              : "Review and confirm"}
        </h1>

        {step === 1 && (
          <div className="space-y-3">
            <button
              onClick={() => {
                setAccountMode("patient");
                setRole("patient");
                setStep(2);
              }}
              className="w-full text-left rounded-2xl bg-white border-2 border-navy-900/10 p-5 hover:border-intake-500 hover:bg-intake-50"
            >
              <div className="font-bold text-navy-900 text-lg">
                A patient or carer
              </div>
              <div className="text-sm text-fog-600 mt-1">
                Recording your own fluids, or a family member's
              </div>
            </button>
            <button
              onClick={() => {
                setAccountMode("healthcare");
                setRole("nurse");
                setStep(2);
              }}
              className="w-full text-left rounded-2xl bg-white border-2 border-navy-900/10 p-5 hover:border-output-500 hover:bg-output-50"
            >
              <div className="font-bold text-navy-900 text-lg">
                A healthcare professional
              </div>
              <div className="text-sm text-fog-600 mt-1">
                Nurse, healthcare assistant or clinician
              </div>
            </button>
          </div>
        )}

        {step === 2 && accountMode === "patient" && (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-navy-700">
              Display name or nickname
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Sam"
                className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
              />
            </label>
            <div>
              <p className="text-sm font-semibold text-navy-700 mb-1.5">
                Tracking fluids for
              </p>
              <SegmentedTabs
                label="Tracking fluids for"
                value={role === "family_carer" ? "family_carer" : "patient"}
                onChange={setRole}
                options={PATIENT_ROLE_OPTIONS}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-700 mb-1.5">
                Preferred units
              </p>
              <SegmentedTabs
                label="Preferred units"
                value={units}
                onChange={setUnits}
                options={UNITS_OPTIONS}
              />
            </div>
            <label className="block text-sm font-semibold text-navy-700">
              Timezone
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal bg-white"
              >
                {tzOptions.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
              <input
                type="checkbox"
                checked={wantsAllowance}
                onChange={(e) => setWantsAllowance(e.target.checked)}
                className="w-5 h-5"
              />
              I need to track a fluid allowance
            </label>
            {wantsAllowance && (
              <label className="block text-sm font-semibold text-navy-700">
                Allowance, if already set by your healthcare team (mL/day,
                optional)
                <input
                  inputMode="decimal"
                  value={allowanceMl}
                  onChange={(e) => setAllowanceMl(e.target.value)}
                  placeholder="e.g. 1500"
                  className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
                />
              </label>
            )}
            <p className="text-xs text-fog-500">
              You can add favourite drinks, containers and reminders any time
              from Profile and My drinks.
            </p>
            <Button fullWidth onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        )}

        {step === 2 && accountMode === "healthcare" && (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-navy-700">
              Display name
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. J. Patel"
                className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
              />
            </label>
            <div>
              <p className="text-sm font-semibold text-navy-700 mb-1.5">Role</p>
              <SegmentedTabs
                label="Role"
                value={role}
                onChange={setRole}
                options={HEALTHCARE_ROLE_OPTIONS}
              />
            </div>
            <label className="block text-sm font-semibold text-navy-700">
              Organisation (optional)
              <input
                value={organisationName}
                onChange={(e) => setOrganisationName(e.target.value)}
                placeholder="e.g. City Hospital"
                className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
              />
            </label>
            <div>
              <p className="text-sm font-semibold text-navy-700 mb-1.5">
                Preferred units
              </p>
              <SegmentedTabs
                label="Preferred units"
                value={units}
                onChange={setUnits}
                options={UNITS_OPTIONS}
              />
            </div>
            <label className="block text-sm font-semibold text-navy-700">
              Timezone
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal bg-white"
              >
                {tzOptions.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
              <input
                type="checkbox"
                checked={isTestWorkspace}
                onChange={(e) => setIsTestWorkspace(e.target.checked)}
                className="w-5 h-5"
              />
              This is a test / training workspace
            </label>
            <Button fullWidth onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Card className="p-5">
              <p className="text-sm text-navy-800">
                FluidSense records fluid events and summarises the information
                entered. It cannot measure fluids that were not recorded and
                does not determine a patient's true fluid status.
              </p>
            </Card>
            <Card className="p-5 space-y-1 text-sm text-fog-700">
              <p>
                <span className="font-semibold text-navy-800">Using as:</span>{" "}
                {accountMode === "healthcare"
                  ? "Healthcare professional"
                  : "Patient / carer"}
              </p>
              <p>
                <span className="font-semibold text-navy-800">Name:</span>{" "}
                {displayName || "—"}
              </p>
              <p>
                <span className="font-semibold text-navy-800">Units:</span>{" "}
                {units}
              </p>
              <p>
                <span className="font-semibold text-navy-800">Timezone:</span>{" "}
                {timezone}
              </p>
            </Card>
            <Card className="p-5 space-y-3">
              <button
                type="button"
                onClick={() => setShowSignUp((v) => !v)}
                className="w-full text-left"
              >
                <p className="text-sm font-semibold text-navy-800">
                  Create an account
                </p>
                <p className="text-xs text-fog-500 mt-1">
                  FluidSense requires an account to continue. You can do this
                  now, or skip ahead and sign in on the next screen.
                </p>
              </button>
              {showSignUp && (
                <div className="space-y-3 pt-2 border-t border-navy-900/10">
                  {signUpDone ? (
                    <p className="text-sm text-navy-700 font-semibold">
                      Account created — continue below to finish setup.
                    </p>
                  ) : signUpUseMagicLink ? (
                    <MagicLinkForm
                      redirectTo={`${window.location.origin}/auth/callback`}
                    />
                  ) : (
                    <EmailPasswordForm
                      mode="sign-up"
                      onSuccess={() => setSignUpDone(true)}
                    />
                  )}
                  {!signUpDone && (
                    <button
                      type="button"
                      onClick={() => setSignUpUseMagicLink((v) => !v)}
                      className="text-xs text-fog-500 underline hover:no-underline"
                    >
                      {signUpUseMagicLink
                        ? "Use a password instead"
                        : "Use a magic link instead"}
                    </button>
                  )}
                </div>
              )}
            </Card>
            <Button fullWidth size="xl" onClick={finish}>
              Start using FluidSense
            </Button>
            <Button fullWidth variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
