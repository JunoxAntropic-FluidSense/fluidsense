import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { useAuthStore } from "../store/useAuthStore";
import { supabase } from "../lib/supabase";
import { useActivePatient, useFluidData } from "../hooks/useFluidData";
import { Card, CardHeading } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Field";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import { getPeriodRange } from "../lib/period";
import type { MonitoringDayStartMode } from "../types";

const DAY_START_OPTIONS: { value: MonitoringDayStartMode; label: string }[] = [
  { value: "midnight", label: "At midnight" },
  { value: "custom_time", label: "Custom time" },
  { value: "on_demand", label: "On demand" },
];

export function DataSettingsPage() {
  const navigate = useNavigate();
  const patient = useActivePatient();
  const currentUser = useStore((s) => s.currentUser);
  const monitoringPeriods = useStore((s) => s.monitoringPeriods);
  const events = useStore((s) => s.events);
  const startNewDay = useStore((s) => s.startNewDay);
  const setMonitoringDayStart = useStore((s) => s.setMonitoringDayStart);
  const clearTodayEntries = useStore((s) => s.clearTodayEntries);
  const deleteAllFluidData = useStore((s) => s.deleteAllFluidData);
  const resetAccount = useStore((s) => s.resetAccount);
  const { range } = useFluidData("monitoring_day");
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);

  const [confirmStep, setConfirmStep] = useState<
    | null
    | "startDay"
    | "clearToday"
    | "deleteAll"
    | "resetAccount"
    | "deleteAccount"
  >(null);
  const [deleteAllText, setDeleteAllText] = useState("");
  const [resetText, setResetText] = useState("");
  const [deleteAccountText, setDeleteAccountText] = useState("");
  const [deleteAccountPending, setDeleteAccountPending] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(
    null
  );
  const [deleteAccountRequested, setDeleteAccountRequested] = useState(false);

  if (!patient) return null;

  const now = new Date();
  const monitoringDayRange = getPeriodRange("monitoring_day", now, {
    patient,
    activePeriod:
      monitoringPeriods.find(
        (mp) => mp.profileId === patient.id && mp.status === "active"
      ) ?? null,
  });
  const activeDayCount = events.filter(
    (e) =>
      !e.deleted &&
      e.patientId === patient.id &&
      new Date(e.eventTime) >= monitoringDayRange.start &&
      new Date(e.eventTime) <= monitoringDayRange.end
  ).length;
  const totalEntryCount = events.filter(
    (e) => !e.deleted && e.patientId === patient.id
  ).length;

  const closeConfirm = () => {
    setConfirmStep(null);
    setDeleteAllText("");
    setResetText("");
    setDeleteAccountText("");
    setDeleteAccountError(null);
  };

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">
          Data and monitoring settings
        </h1>
        <p className="text-sm text-fog-600">{range.label}</p>
      </div>

      <Card className="p-5">
        <CardHeading>Start a new monitoring day</CardHeading>
        <p className="text-sm text-fog-600 mb-3">
          Begins a new monitoring period. Today's dashboard will start from zero
          — all previous entries stay in History.
        </p>
        <Button variant="secondary" onClick={() => setConfirmStep("startDay")}>
          Start new day
        </Button>
      </Card>

      <Card className="p-5">
        <CardHeading>Monitoring-day start time</CardHeading>
        <p className="text-sm text-fog-600 mb-3">
          Choose when a new monitoring day begins by default.
        </p>
        <div className="space-y-3">
          <SegmentedTabs
            label="Monitoring-day start time"
            value={patient.monitoringDayStartMode}
            onChange={(mode) => {
              if (mode === "custom_time") {
                setMonitoringDayStart(
                  patient.id,
                  "custom_time",
                  patient.monitoringDayCustomHour ?? 6
                );
              } else {
                setMonitoringDayStart(patient.id, mode);
              }
            }}
            options={DAY_START_OPTIONS}
          />
          {patient.monitoringDayStartMode === "custom_time" && (
            <Select
              value={patient.monitoringDayCustomHour ?? 6}
              onChange={(e) =>
                setMonitoringDayStart(
                  patient.id,
                  "custom_time",
                  parseInt(e.target.value, 10)
                )
              }
              className="max-w-[160px] py-2 text-sm"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </Select>
          )}
          {patient.monitoringDayStartMode === "on_demand" && (
            <p className="text-xs text-fog-500">
              A new monitoring day begins the moment you press "Start new day"
              above.
            </p>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <CardHeading>Clear today's entries</CardHeading>
        <p className="text-sm text-fog-600 mb-3">
          Deletes only entries in the active monitoring day ({activeDayCount}{" "}
          entr{activeDayCount === 1 ? "y" : "ies"}). History outside this period
          is not affected.
        </p>
        <Button
          variant="danger"
          disabled={activeDayCount === 0}
          onClick={() => setConfirmStep("clearToday")}
        >
          Delete entries from current monitoring day
        </Button>
      </Card>

      <Card className="p-5">
        <CardHeading>History</CardHeading>
        <p className="text-sm text-fog-600 mb-3">
          Select, edit or delete individual entries across any date range.
        </p>
        <Button variant="secondary" onClick={() => navigate("/history")}>
          Go to History
        </Button>
      </Card>

      <Card className="p-5 border-2 border-alert-100">
        <CardHeading>Delete all fluid data</CardHeading>
        <p className="text-sm text-fog-600 mb-3">
          Removes all {totalEntryCount} intake and output events, weight entries
          and symptom entries. Your profile, saved containers and drinks are
          kept.
        </p>
        <Button
          variant="danger"
          disabled={totalEntryCount === 0}
          onClick={() => setConfirmStep("deleteAll")}
        >
          Delete all fluid entries
        </Button>
      </Card>

      <Card className="p-5 border-2 border-alert-100">
        <CardHeading>Reset FluidSense account</CardHeading>
        <p className="text-sm text-fog-600 mb-3">
          Deletes all fluid events, weight and symptom records, saved drinks,
          containers, reminders, monitoring settings and profiles, then returns
          you to onboarding.
        </p>
        <Button variant="danger" onClick={() => setConfirmStep("resetAccount")}>
          Reset FluidSense account
        </Button>
      </Card>

      {authStatus === "signed-in" ? (
        <Card className="p-5 border-2 border-alert-100">
          <CardHeading>Delete account</CardHeading>
          <p className="text-sm text-fog-600 mb-3">
            Submits a request to delete your account. This does not delete
            anything immediately — your data stays as-is until the request is
            processed separately, and you'll remain signed in until then.
          </p>
          {deleteAccountRequested ? (
            <p className="text-sm font-semibold text-navy-700">
              Deletion request submitted.
            </p>
          ) : (
            <Button
              variant="danger"
              onClick={() => setConfirmStep("deleteAccount")}
            >
              Request account deletion
            </Button>
          )}
        </Card>
      ) : (
        <Card className="p-5">
          <CardHeading>Delete account</CardHeading>
          <p className="text-sm text-fog-600">
            Permanent account deletion will be available once sign-in is enabled
            for {currentUser.displayName || "this account"}. For now, use "Reset
            FluidSense account" above to remove all local data.
          </p>
        </Card>
      )}

      {confirmStep === "startDay" && (
        <ConfirmModal
          title="Start a new monitoring day?"
          body="Today's dashboard will begin from zero. Previous entries will remain available in History and will not be deleted."
          confirmLabel="Start new day"
          onConfirm={() => {
            startNewDay(patient.id);
            closeConfirm();
            navigate("/");
          }}
          onCancel={closeConfirm}
        />
      )}

      {confirmStep === "clearToday" && (
        <ConfirmModal
          title="Delete entries from the current monitoring day?"
          body={`This will permanently remove ${activeDayCount} entr${activeDayCount === 1 ? "y" : "ies"} from the active monitoring day. Entries outside this period are not affected.`}
          confirmLabel="Delete entries"
          danger
          onConfirm={() => {
            clearTodayEntries(
              patient.id,
              currentUser.displayName,
              monitoringDayRange.start,
              monitoringDayRange.end
            );
            closeConfirm();
            navigate("/");
          }}
          onCancel={closeConfirm}
        />
      )}

      {confirmStep === "deleteAll" && (
        <ConfirmModal
          title="Delete all fluid entries?"
          body={`This permanently removes all ${totalEntryCount} intake and output events, plus all weight and symptom entries, for this profile. Type DELETE to confirm.`}
          confirmLabel="Delete all fluid entries"
          danger
          requireText="DELETE"
          textValue={deleteAllText}
          onTextChange={setDeleteAllText}
          onConfirm={() => {
            deleteAllFluidData();
            closeConfirm();
            navigate("/");
          }}
          onCancel={closeConfirm}
        />
      )}

      {confirmStep === "resetAccount" && (
        <ConfirmModal
          title="Reset your FluidSense account?"
          body="This permanently deletes everything — all fluid data, saved drinks, containers, reminders and your profile — and returns you to onboarding. Type RESET to confirm."
          confirmLabel="Reset account"
          danger
          requireText="RESET"
          textValue={resetText}
          onTextChange={setResetText}
          onConfirm={() => {
            resetAccount();
            closeConfirm();
            navigate("/welcome");
          }}
          onCancel={closeConfirm}
        />
      )}

      {confirmStep === "deleteAccount" && (
        <ConfirmModal
          title="Request account deletion?"
          body={`This submits a request to delete your account. It does not delete anything immediately — your data stays as-is until the request is processed separately, and you'll remain signed in until then.${deleteAccountError ? `\n\n${deleteAccountError}` : ""} Type DELETE to confirm.`}
          confirmLabel={
            deleteAccountPending ? "Submitting..." : "Request deletion"
          }
          danger
          requireText="DELETE"
          textValue={deleteAccountText}
          onTextChange={setDeleteAccountText}
          confirmDisabled={deleteAccountPending}
          onConfirm={() => {
            if (!supabase || !authUser || deleteAccountPending) return;
            setDeleteAccountPending(true);
            setDeleteAccountError(null);
            supabase
              .from("account_deletion_requests")
              .insert({ user_id: authUser.id })
              .then(({ error }) => {
                setDeleteAccountPending(false);
                if (error) {
                  setDeleteAccountError(
                    "Couldn't submit the request. Please try again."
                  );
                  return;
                }
                setDeleteAccountRequested(true);
                closeConfirm();
              });
          }}
          onCancel={closeConfirm}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  danger,
  requireText,
  textValue,
  onTextChange,
  confirmDisabled,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  requireText?: string;
  textValue?: string;
  onTextChange?: (v: string) => void;
  confirmDisabled?: boolean;
}) {
  const locked =
    (!!requireText && textValue !== requireText) || !!confirmDisabled;
  return (
    <div
      className="fixed inset-0 z-40 flex items-end md:items-center md:justify-center bg-navy-950/40"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white w-full md:max-w-md md:rounded-3xl rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <h2 className="text-lg font-extrabold text-navy-900 mb-2">{title}</h2>
        <p className="text-sm text-fog-600 mb-4">{body}</p>
        {requireText && (
          <Input
            value={textValue}
            onChange={(e) => onTextChange?.(e.target.value)}
            placeholder={`Type ${requireText} to confirm`}
            aria-label={`Type ${requireText} to confirm`}
            className="mb-4 font-mono"
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            disabled={locked}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
