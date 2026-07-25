import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useStore } from "../../store/useStore";
import { useAuthStore } from "../../store/useAuthStore";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PrototypeBanner } from "../../components/ui/PrototypeBanner";
import { SegmentedTabs } from "../../components/ui/SegmentedTabs";
import { Field, Input, Select } from "../../components/ui/Field";
import { Checkbox } from "../../components/ui/Checkbox";
import { WorkspaceSetup } from "../../components/onboarding/WorkspaceSetup";
import { enableCheckInPush } from "../../lib/push/subscribe";
import { syncAccountRoleNow } from "../../lib/supabase/accountSync";
import type { Mode, Role, Sex, Units } from "../../types";

const UNITS_OPTIONS: { value: Units; label: string }[] = [
  { value: "mL", label: "mL" },
  { value: "L", label: "Litres" },
];

const PATIENT_ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "patient", label: "Myself" },
  { value: "family_carer", label: "Someone else" },
];

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
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

function SectionHeading({ children }: { children: string }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wide text-fog-500 mt-6 mb-2 first:mt-0">
      {children}
    </p>
  );
}

export function OnboardingFlow() {
  const navigate = useNavigate();
  const onboardingCompleted = useStore(
    (s) => s.currentUser.onboardingCompleted
  );
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const setCheckInNotificationsEnabled = useStore(
    (s) => s.setCheckInNotificationsEnabled
  );
  const setOrganisation = useStore((s) => s.setOrganisation);

  const detectedTz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );
  const [step, setStep] = useState(1);
  const [accountMode, setAccountMode] = useState<Mode | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("patient");
  const [sex, setSex] = useState<Sex>("prefer_not_to_say");
  const [careSetting, setCareSetting] = useState("");
  const [units, setUnits] = useState<Units>("mL");
  const [timezone, setTimezone] = useState(detectedTz);
  const [wantsAllowance, setWantsAllowance] = useState(false);
  const [allowanceMl, setAllowanceMl] = useState("");
  const [dailyWeightEnabled, setDailyWeightEnabled] = useState(false);
  const [saveVoiceTranscripts, setSaveVoiceTranscripts] = useState(true);
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [careTeamShareConsent, setCareTeamShareConsent] = useState(false);
  const [wantsCheckInReminders, setWantsCheckInReminders] = useState(false);
  const [joinedOrgId, setJoinedOrgId] = useState<string | null>(null);
  const [joinedOrgName, setJoinedOrgName] = useState<string | null>(null);
  const [isTestWorkspace, setIsTestWorkspace] = useState(true);
  const [roleSynced, setRoleSynced] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // WorkspaceSetup's create_organisation RPC checks the caller's
  // public.users.role server-side (0004_care_teams.sql) — but that row only
  // gets the role written to it once completeOnboarding() runs, at the very
  // end of this flow. Without this, clicking "Create workspace" here (before
  // completeOnboarding) always fails with "Only healthcare accounts can
  // create a workspace," because the server still sees whatever role (or no
  // row at all) existed before onboarding started. Push role/mode directly
  // and wait for confirmation before rendering WorkspaceSetup at all.
  useEffect(() => {
    if (accountMode !== "healthcare" || !authUser) return;
    let cancelled = false;
    setRoleSynced(false);
    void syncAccountRoleNow(authUser.id, role, "healthcare").then((ok) => {
      if (!cancelled && ok) setRoleSynced(true);
    });
    return () => {
      cancelled = true;
    };
  }, [accountMode, authUser, role]);

  if (onboardingCompleted) return <Navigate to="/" replace />;
  // Onboarding assumes an authenticated user throughout (account creation
  // now happens on WelcomePage, before ever reaching here) — guard against
  // landing on this URL directly (stale tab, bookmark, manual navigation)
  // without a session, which would otherwise lose everything typed in here
  // the moment `finish()` tries to enter the app and gets bounced by
  // RequireOnboarding.
  if (authStatus === "loading") return null;
  if (authStatus !== "signed-in") return <Navigate to="/welcome" replace />;

  const tzOptions = timezoneOptions(detectedTz);
  const isPatient = accountMode === "patient";
  const isHealthcare = accountMode === "healthcare";

  const finish = async () => {
    setFinishing(true);
    completeOnboarding({
      accountMode: accountMode ?? "patient",
      displayName: displayName.trim() || (isHealthcare ? "Staff member" : "Me"),
      role: isHealthcare
        ? role
        : role === "patient" || role === "family_carer"
          ? role
          : "patient",
      units,
      timezone,
      wantsAllowanceTracking: isPatient ? wantsAllowance : undefined,
      allowanceMl: allowanceMl ? parseFloat(allowanceMl) : undefined,
      organisationName: joinedOrgName || undefined,
      isTestWorkspace,
      careSetting: isPatient ? careSetting : undefined,
      sex: isPatient ? sex : undefined,
      dailyWeightEnabled: isPatient ? dailyWeightEnabled : undefined,
      saveVoiceTranscripts,
      accessibility: { largeText, highContrast, reduceMotion },
      careTeamShareConsent: isPatient ? careTeamShareConsent : undefined,
    });

    // completeOnboarding replaces currentUser wholesale, so organisationId
    // must be set after it runs, not before — setting it first would be
    // silently wiped out by that replacement.
    if (isHealthcare && joinedOrgId) {
      setOrganisation(joinedOrgId, joinedOrgName ?? undefined);
    }

    if (isPatient && wantsCheckInReminders) {
      const newPatientId = useStore.getState().activePatientId;
      if (newPatientId) {
        const result = await enableCheckInPush(newPatientId);
        setCheckInNotificationsEnabled(result.ok);
      }
    }
    // Healthcare accounts start with no patients yet — land on the
    // dashboard's "add patient" flow rather than a blank single-patient view.
    navigate(isHealthcare ? "/dashboard" : "/");
  };

  return (
    <div className="min-h-dvh flex flex-col bg-fog-50">
      <PrototypeBanner />
      <div className="flex-1 px-6 py-8 max-w-md mx-auto w-full">
        <p className="text-xs font-bold uppercase tracking-wide text-fog-500 mb-1">
          Step {step} of 2
        </p>
        <h1 className="text-2xl font-extrabold text-navy-900 mb-6">
          {step === 1 ? "How will you use FluidSense?" : "A few details"}
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

        {step === 2 && (
          <div className="space-y-4">
            <SectionHeading>About you</SectionHeading>
            <Field
              label={isPatient ? "Display name or nickname" : "Display name"}
            >
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={isPatient ? "e.g. Sam" : "e.g. J. Patel"}
              />
            </Field>

            {isPatient && (
              <>
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
                <Field label="Care setting">
                  <Input
                    value={careSetting}
                    onChange={(e) => setCareSetting(e.target.value)}
                    placeholder="e.g. Home, Ward 4B"
                  />
                </Field>
                <div>
                  <p className="text-sm font-semibold text-navy-700 mb-1.5">
                    Sex
                  </p>
                  <SegmentedTabs
                    label="Sex"
                    value={sex}
                    onChange={setSex}
                    options={SEX_OPTIONS}
                  />
                  <p className="text-xs text-fog-500 mt-1">
                    Used only to show relevant logging options, like menstrual
                    pad tracking.
                  </p>
                </div>
              </>
            )}

            {isHealthcare && (
              <>
                <div>
                  <p className="text-sm font-semibold text-navy-700 mb-1.5">
                    Role
                  </p>
                  <SegmentedTabs
                    label="Role"
                    value={role}
                    onChange={setRole}
                    options={HEALTHCARE_ROLE_OPTIONS}
                  />
                </div>
                {joinedOrgId ? (
                  <p className="text-sm text-navy-700 font-semibold">
                    Workspace set up
                    {joinedOrgName ? `: ${joinedOrgName}` : ""} — continue
                    below.
                  </p>
                ) : roleSynced ? (
                  <WorkspaceSetup
                    onJoined={(id, name) => {
                      setJoinedOrgId(id);
                      setJoinedOrgName(name);
                    }}
                  />
                ) : (
                  <p className="text-xs text-fog-500">
                    Setting up your account…
                  </p>
                )}
              </>
            )}

            <SectionHeading>Preferences</SectionHeading>
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
            <Field label="Timezone">
              <Select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {tzOptions.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
              <Checkbox
                checked={saveVoiceTranscripts}
                onChange={(e) => setSaveVoiceTranscripts(e.target.checked)}
              />
              Save the transcript with voice-created entries
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
                <Checkbox
                  checked={largeText}
                  onChange={(e) => setLargeText(e.target.checked)}
                />
                Large text
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
                <Checkbox
                  checked={highContrast}
                  onChange={(e) => setHighContrast(e.target.checked)}
                />
                High contrast
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
                <Checkbox
                  checked={reduceMotion}
                  onChange={(e) => setReduceMotion(e.target.checked)}
                />
                Reduce motion
              </label>
            </div>

            {isPatient && (
              <>
                <SectionHeading>Monitoring</SectionHeading>
                <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
                  <Checkbox
                    checked={wantsAllowance}
                    onChange={(e) => setWantsAllowance(e.target.checked)}
                  />
                  I need to track a fluid allowance
                </label>
                {wantsAllowance && (
                  <Field label="Allowance, if already set by your healthcare team (mL/day, optional)">
                    <Input
                      inputMode="decimal"
                      value={allowanceMl}
                      onChange={(e) => setAllowanceMl(e.target.value)}
                      placeholder="e.g. 1500"
                    />
                  </Field>
                )}
                <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
                  <Checkbox
                    checked={dailyWeightEnabled}
                    onChange={(e) => setDailyWeightEnabled(e.target.checked)}
                  />
                  Track daily weight
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
                  <Checkbox
                    checked={wantsCheckInReminders}
                    onChange={(e) => setWantsCheckInReminders(e.target.checked)}
                  />
                  Remind me if I haven't logged anything in a while
                </label>

                <SectionHeading>Sharing</SectionHeading>
                <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
                  <Checkbox
                    checked={careTeamShareConsent}
                    onChange={(e) => setCareTeamShareConsent(e.target.checked)}
                  />
                  Allow sharing my summary with care team contacts I add later
                </label>
              </>
            )}

            {isHealthcare && (
              <label className="flex items-center gap-2 text-sm font-semibold text-navy-700">
                <Checkbox
                  checked={isTestWorkspace}
                  onChange={(e) => setIsTestWorkspace(e.target.checked)}
                />
                This is a test / training workspace
              </label>
            )}

            <p className="text-xs text-fog-500">
              Everything here stays editable later from Profile.
            </p>

            <Card className="p-5">
              <p className="text-sm text-navy-800">
                FluidSense records fluid events and summarises the information
                entered. It cannot measure fluids that were not recorded and
                does not determine a patient's true fluid status.
              </p>
            </Card>

            <Button fullWidth size="xl" onClick={finish} disabled={finishing}>
              {finishing ? "Setting up…" : "Start using FluidSense"}
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onClick={() => setStep(1)}
              disabled={finishing}
            >
              Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
