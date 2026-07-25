import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../store/useStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ReliabilityPill } from "../components/ui/ReliabilityPill";
import { StatRow } from "../components/ui/StatRow";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import { FocusCardGrid } from "../components/ui/FocusCardGrid";
import { Field, Input } from "../components/ui/Field";
import {
  eventsInWindow,
  computeBalance,
  formatMl,
  formatMlPlain,
} from "../lib/calc";
import { computeReliability } from "../lib/reliability";
import { getPeriodRange } from "../lib/period";
import { formatDistanceToNow, subDays } from "date-fns";
import type { DeploymentMode } from "../types";
import { sendPatientInvitation } from "../lib/patients/sendInvitation";
import { createOrganisationInvite } from "../lib/supabase/organisations";
import { pullOrganisationData } from "../lib/supabase/patientSync";
import { supabase } from "../lib/supabase/client";
import {
  AttentionSection,
  type AttentionCategory,
} from "../components/dashboard/AttentionSection";
import {
  ReliabilityDistributionChart,
  EntriesTrendChart,
} from "../components/dashboard/DashboardCharts";

const DEPLOYMENT_MODE_OPTIONS: { value: DeploymentMode; label: string }[] = [
  { value: "home_community", label: "Home & community" },
  { value: "inpatient", label: "Inpatient" },
];

type SortKey =
  | "reliability"
  | "output_gap"
  | "largest_positive"
  | "largest_negative"
  | "unmeasured";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "reliability", label: "Lowest reliability" },
  { value: "output_gap", label: "Time since output" },
  { value: "largest_positive", label: "Largest positive balance" },
  { value: "largest_negative", label: "Largest negative balance" },
  { value: "unmeasured", label: "Most unmeasured" },
];

const RELIABILITY_RANK = { Low: 0, Moderate: 1, High: 2 };

export function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const patients = useStore((s) => s.patients);
  const events = useStore((s) => s.events);
  const weightEvents = useStore((s) => s.weightEvents);
  const dialysisAppointments = useStore((s) => s.dialysisAppointments);
  const setActivePatient = useStore((s) => s.setActivePatient);
  const addPatient = useStore((s) => s.addPatient);
  const updatePatient = useStore((s) => s.updatePatient);
  const setAllowance = useStore((s) => s.setAllowance);
  const viewContext = useStore((s) => s.viewContext);
  const currentUser = useStore((s) => s.currentUser);
  const [sortKey, setSortKey] = useState<SortKey>("reliability");
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSetting, setNewSetting] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [invitePending, setInvitePending] = useState(false);
  const [allowanceDrafts, setAllowanceDrafts] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (searchParams.get("addPatient") === "true") {
      setShowAddPatient(true);
      searchParams.delete("addPatient");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [offboardTarget, setOffboardTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [offboarding, setOffboarding] = useState(false);

  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => getPeriodRange("24h", now), [now]);

  const rows = useMemo(
    () =>
      patients.map((p) => {
        const windowEvents = eventsInWindow(
          events,
          p.id,
          range.start,
          range.end
        );
        const balance = computeBalance(windowEvents);
        const reliability = computeReliability(
          windowEvents,
          range.label,
          range.start,
          range.end
        );
        const lastIntake = windowEvents.find((e) => e.direction === "intake");
        const lastOutput = windowEvents.find((e) => e.direction === "output");
        const lastWeight = weightEvents
          .filter((w) => w.patientId === p.id)
          .sort(
            (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
          )[0];
        const outputGapMs = lastOutput
          ? now.getTime() - new Date(lastOutput.eventTime).getTime()
          : Infinity;
        return {
          patient: p,
          balance,
          reliability,
          lastIntake,
          lastOutput,
          lastWeight,
          outputGapMs,
        };
      }),
    [patients, events, weightEvents, range, now]
  );

  const sorted = useMemo(() => {
    const arr = [...rows];
    switch (sortKey) {
      case "reliability":
        return arr.sort(
          (a, b) =>
            RELIABILITY_RANK[a.reliability.level] -
            RELIABILITY_RANK[b.reliability.level]
        );
      case "output_gap":
        return arr.sort((a, b) => b.outputGapMs - a.outputGapMs);
      case "largest_positive":
        return arr.sort(
          (a, b) => b.balance.recordedBalanceMl - a.balance.recordedBalanceMl
        );
      case "largest_negative":
        return arr.sort(
          (a, b) => a.balance.recordedBalanceMl - b.balance.recordedBalanceMl
        );
      case "unmeasured":
        return arr.sort(
          (a, b) => b.balance.unmeasuredCount - a.balance.unmeasuredCount
        );
      default:
        return arr;
    }
  }, [rows, sortKey]);

  const openPatient = (id: string) => {
    setActivePatient(id);
    navigate("/");
  };

  // Each category flags a gap in the recorded data (or a logged missed
  // appointment) — never a clinical judgment about the patient. See
  // AttentionSection's own note and CLAUDE.md hard rule 2.
  const attentionCategories: AttentionCategory[] = useMemo(() => {
    const weekAgo = subDays(now, 7);
    const missedDialysisPatientIds = new Set(
      dialysisAppointments
        .filter((d) => !d.attended && new Date(d.scheduledTime) >= weekAgo)
        .map((d) => d.patientId)
    );
    return [
      {
        key: "low_reliability",
        label: "Low data reliability",
        description:
          "Recorded data has significant gaps over the last 24 hours.",
        patients: rows
          .filter((r) => r.reliability.level === "Low")
          .map((r) => r.patient),
      },
      {
        key: "no_output",
        label: "No output recorded recently",
        description: "No output has been logged for an extended period.",
        patients: rows
          .filter((r) => r.outputGapMs > 10 * 60 * 60 * 1000)
          .map((r) => r.patient),
      },
      {
        key: "unresolved_warnings",
        label: "Unresolved data warnings",
        description:
          "Possible duplicate or unusually large entries not yet resolved.",
        patients: rows
          .filter((r) => r.reliability.unresolvedWarnings.length > 0)
          .map((r) => r.patient),
      },
      {
        key: "missed_dialysis",
        label: "Missed dialysis appointment recorded",
        description:
          "A dialysis session was logged as missed in the last 7 days.",
        patients: rows
          .filter((r) => missedDialysisPatientIds.has(r.patient.id))
          .map((r) => r.patient),
      },
    ];
  }, [rows, dialysisAppointments, now]);

  const attentionPatientCount = useMemo(() => {
    const ids = new Set<string>();
    attentionCategories.forEach((c) =>
      c.patients.forEach((p) => ids.add(p.id))
    );
    return ids.size;
  }, [attentionCategories]);

  const entriesToday = useMemo(
    () =>
      events.filter(
        (e) =>
          !e.deleted &&
          patients.some((p) => p.id === e.patientId) &&
          new Date(e.eventTime) >= range.start
      ).length,
    [events, patients, range]
  );

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">
            Patient dashboard
          </h1>
          <p className="text-sm text-fog-600">
            {viewContext === "demo"
              ? "Fictional demo patients"
              : "Your patients"}{" "}
            · Last 24 hours
          </p>
        </div>
        {viewContext === "live" && (
          <div className="flex items-center gap-2">
            <Button
              size="md"
              variant="secondary"
              onClick={() => void pullOrganisationData()}
            >
              Sync Workspace
            </Button>
            <Button size="md" onClick={() => setShowAddPatient(true)}>
              Add patient
            </Button>
          </div>
        )}
      </div>

      {sorted.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-xs font-semibold text-fog-500">Patients</p>
              <p className="text-2xl font-extrabold text-navy-900 mt-1">
                {patients.length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold text-fog-500">
                Needs attention
              </p>
              <p className="text-2xl font-extrabold text-navy-900 mt-1">
                {attentionPatientCount}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold text-fog-500">
                Entries, last 24h
              </p>
              <p className="text-2xl font-extrabold text-navy-900 mt-1">
                {entriesToday}
              </p>
            </Card>
          </div>

          <AttentionSection
            categories={attentionCategories}
            onOpenPatient={openPatient}
          />

          <div className="grid md:grid-cols-2 gap-4">
            <ReliabilityDistributionChart
              levels={rows.map((r) => r.reliability.level)}
            />
            <EntriesTrendChart
              events={events}
              patientIds={patients.map((p) => p.id)}
            />
          </div>
        </>
      )}

      <div>
        <p className="text-sm font-semibold text-navy-700 mb-1.5">Sort by</p>
        <SegmentedTabs
          label="Sort patients by"
          value={sortKey}
          onChange={setSortKey}
          options={SORT_OPTIONS}
        />
      </div>

      {sorted.length === 0 && (
        <div className="relative">
          {/* Decorative mock of a populated dashboard — fake placeholder
              numbers/labels only, purely to preview the layout behind the
              real CTA. Never real or demo patient data. */}
          <div
            aria-hidden="true"
            className="pointer-events-none select-none blur-sm opacity-50 space-y-4"
          >
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4">
                <p className="text-xs font-semibold text-fog-500">Patients</p>
                <p className="text-2xl font-extrabold text-navy-900 mt-1">8</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-semibold text-fog-500">
                  Needs attention
                </p>
                <p className="text-2xl font-extrabold text-navy-900 mt-1">2</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-semibold text-fog-500">
                  Entries, last 24h
                </p>
                <p className="text-2xl font-extrabold text-navy-900 mt-1">34</p>
              </Card>
            </div>
            <Card className="p-5">
              <p className="text-base font-bold text-navy-900 mb-3">
                Needs attention
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-navy-900/10 bg-white p-4">
                  <p className="text-2xl font-extrabold text-navy-900">1</p>
                  <p className="text-sm font-semibold text-navy-800">
                    Low data reliability
                  </p>
                </div>
                <div className="rounded-2xl border border-navy-900/10 bg-white p-4">
                  <p className="text-2xl font-extrabold text-navy-900">1</p>
                  <p className="text-sm font-semibold text-navy-800">
                    No output recorded recently
                  </p>
                </div>
              </div>
            </Card>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-5">
                <p className="text-base font-bold text-navy-900 mb-3">
                  Reliability across patients
                </p>
                <div className="space-y-2">
                  <div className="h-3 rounded-full bg-intake-200 w-4/5" />
                  <div className="h-3 rounded-full bg-amber-200 w-2/5" />
                  <div className="h-3 rounded-full bg-alert-100 w-1/5" />
                </div>
              </Card>
              <Card className="p-5">
                <p className="text-base font-bold text-navy-900 mb-3">
                  Recorded entries, last 7 days
                </p>
                <div className="flex items-end gap-2 h-24">
                  {[40, 65, 50, 80, 60, 90, 70].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-md bg-intake-200"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </Card>
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="p-6 text-center space-y-3 shadow-xl max-w-sm w-full">
              <p className="font-bold text-navy-900 text-lg">No patients yet</p>
              <p className="text-sm text-fog-600">
                Add your first patient to start recording and reviewing their
                fluid data.
              </p>
              {viewContext === "live" && (
                <Button fullWidth onClick={() => setShowAddPatient(true)}>
                  Add patient
                </Button>
              )}
            </Card>
          </div>
        </div>
      )}

      <FocusCardGrid>
        {sorted.map(
          ({
            patient,
            balance,
            reliability,
            lastIntake,
            lastOutput,
            lastWeight,
          }) => (
            <Card key={patient.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-extrabold text-navy-900">
                    {patient.displayName}
                  </h2>
                  <p className="text-xs text-fog-500">{patient.careSetting}</p>
                  {patient.monitoringReason && (
                    <p className="text-xs text-fog-500">
                      {patient.monitoringReason}
                    </p>
                  )}
                </div>
                <ReliabilityPill level={reliability.level} />
              </div>

              <div className="mt-3">
                {patient.assignedClinicianId === currentUser.id ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-intake-50 border border-intake-200 px-3 py-2">
                    <span className="text-xs font-semibold text-intake-700">
                      Checked in by you
                    </span>
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={() =>
                        updatePatient(patient.id, {
                          assignedClinicianId: undefined,
                          assignedClinicianName: undefined,
                          assignedAt: undefined,
                        })
                      }
                    >
                      Check out
                    </Button>
                  </div>
                ) : patient.assignedClinicianId ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-fog-50 px-3 py-2">
                    <span className="text-xs text-fog-600">
                      Checked in: {patient.assignedClinicianName}
                    </span>
                  </div>
                ) : (
                  <Button
                    size="md"
                    variant="secondary"
                    fullWidth
                    onClick={() =>
                      updatePatient(patient.id, {
                        assignedClinicianId: currentUser.id,
                        assignedClinicianName:
                          currentUser.displayName || "Team member",
                        assignedAt: new Date().toISOString(),
                      })
                    }
                  >
                    Check in
                  </Button>
                )}
              </div>

              <div className="mt-3">
                <p className="text-xs font-semibold text-navy-700 mb-1">
                  Monitoring mode
                </p>
                <SegmentedTabs
                  label={`Monitoring mode for ${patient.displayName}`}
                  value={patient.deploymentMode ?? "home_community"}
                  onChange={(deploymentMode) =>
                    updatePatient(patient.id, { deploymentMode })
                  }
                  options={DEPLOYMENT_MODE_OPTIONS}
                />
                <p className="text-xs text-fog-500 mt-1">
                  {(patient.deploymentMode ?? "home_community") ===
                  "home_community"
                    ? "Patient/carer records everything. You can review and add notes, but not alter their entries."
                    : "Staff record most entries; the patient may also contribute. Staff can verify, correct, or reject any entry."}
                </p>
              </div>

              <dl className="mt-3 space-y-1.5">
                <StatRow
                  dense
                  label="Recorded intake"
                  value={formatMlPlain(balance.totalIntakeMl)}
                />
                <StatRow
                  dense
                  label="Measured output"
                  value={formatMlPlain(balance.measuredOutputMl)}
                />
                <StatRow
                  dense
                  label="Recorded balance"
                  value={formatMl(balance.recordedBalanceMl)}
                  strong
                />
                <StatRow
                  dense
                  label="Unmeasured events"
                  value={String(balance.unmeasuredCount)}
                />
                <StatRow
                  dense
                  label="Last intake"
                  value={
                    lastIntake
                      ? formatDistanceToNow(new Date(lastIntake.eventTime), {
                          addSuffix: true,
                        })
                      : "None recorded"
                  }
                />
                <StatRow
                  dense
                  label="Last output"
                  value={
                    lastOutput
                      ? formatDistanceToNow(new Date(lastOutput.eventTime), {
                          addSuffix: true,
                        })
                      : "None recorded"
                  }
                />
                <StatRow
                  dense
                  label="Last weight"
                  value={
                    lastWeight ? `${lastWeight.weightKg} kg` : "Not recorded"
                  }
                />
                {patient.allowance && (
                  <StatRow
                    dense
                    label="Fluid allowance"
                    value={formatMlPlain(patient.allowance.dailyMl)}
                  />
                )}
              </dl>

              <div className="mt-3">
                <Field label="Fluid allowance (mL/day)">
                  <div className="flex gap-2">
                    <Input
                      inputMode="decimal"
                      value={
                        allowanceDrafts[patient.id] ??
                        (patient.allowance
                          ? String(patient.allowance.dailyMl)
                          : "")
                      }
                      onChange={(e) =>
                        setAllowanceDrafts((d) => ({
                          ...d,
                          [patient.id]: e.target.value,
                        }))
                      }
                      placeholder="e.g. 1500"
                      className="flex-1"
                    />
                    <Button
                      size="md"
                      disabled={!allowanceDrafts[patient.id]?.trim()}
                      onClick={() => {
                        const value = parseFloat(allowanceDrafts[patient.id]);
                        if (!Number.isFinite(value)) return;
                        setAllowance(patient.id, {
                          dailyMl: value,
                          setByName: currentUser.displayName,
                          setByRole: currentUser.role,
                          setAt: new Date().toISOString(),
                        });
                      }}
                    >
                      Set
                    </Button>
                  </div>
                </Field>
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => openPatient(patient.id)}
                >
                  Open patient
                </Button>
                <Button
                  variant="ghost"
                  className="text-xs text-alert-600 hover:text-alert-700 hover:bg-alert-50 px-3"
                  onClick={() =>
                    setOffboardTarget({
                      id: patient.id,
                      name: patient.displayName,
                    })
                  }
                >
                  Offboard
                </Button>
              </div>
            </Card>
          )
        )}
      </FocusCardGrid>

      {offboardTarget && (
        <div
          className="fixed inset-0 z-40 flex items-end md:items-center md:justify-center bg-navy-950/40"
          role="dialog"
          aria-modal="true"
          aria-label="Offboard patient"
        >
          <div className="bg-white w-full md:max-w-md md:rounded-3xl rounded-t-3xl p-5 space-y-4">
            <h2 className="text-lg font-extrabold text-navy-900">
              Offboard {offboardTarget.name}?
            </h2>
            <p className="text-sm text-fog-600">
              This removes the patient from your clinic's workspace caseload.
              Your team will no longer see or receive updates for this patient.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="secondary"
                disabled={offboarding}
                onClick={() => setOffboardTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={offboarding}
                onClick={async () => {
                  setOffboarding(true);
                  updatePatient(offboardTarget.id, {
                    organisationId: undefined,
                  });
                  if (supabase) {
                    await supabase
                      .from("profiles")
                      .update({ organisation_id: null })
                      .eq("id", offboardTarget.id);
                  }
                  setOffboarding(false);
                  setOffboardTarget(null);
                }}
              >
                {offboarding ? "Offboarding..." : "Offboard Patient"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAddPatient && (
        <div
          className="fixed inset-0 z-40 flex items-end md:items-center md:justify-center bg-navy-950/40"
          role="dialog"
          aria-modal="true"
          aria-label="Add patient"
        >
          <div className="bg-white w-full md:max-w-md md:rounded-3xl rounded-t-3xl p-5">
            <h2 className="text-lg font-extrabold text-navy-900 mb-4">
              Add a patient
            </h2>
            <Field label="Display name">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Patient in Bed 4"
              />
            </Field>
            <Field label="Care setting" className="mt-3">
              <Input
                value={newSetting}
                onChange={(e) => setNewSetting(e.target.value)}
                placeholder="e.g. Ward 3B"
              />
            </Field>
            <Field label="Email (optional)" className="mt-3">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Sends a one-off invitation email"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <Button
                variant="secondary"
                onClick={() => setShowAddPatient(false)}
                disabled={invitePending}
              >
                Cancel
              </Button>
              <Button
                disabled={!newName.trim() || invitePending}
                onClick={async () => {
                  const displayName = newName.trim();
                  const email = newEmail.trim();
                  const created = addPatient(
                    displayName,
                    newSetting.trim() || "Not specified"
                  );
                  if (email) {
                    updatePatient(created.id, { patientEmail: email });
                    setInvitePending(true);
                    let clinicInviteCode: string | undefined = undefined;
                    if (currentUser.organisationId) {
                      const invRes = await createOrganisationInvite(
                        currentUser.organisationId
                      );
                      if (invRes.code) clinicInviteCode = invRes.code;
                    }
                    await sendPatientInvitation({
                      patientEmail: email,
                      patientDisplayName: displayName,
                      invitedByName:
                        currentUser.displayName || "Your care team",
                      clinicInviteCode,
                      organisationName: currentUser.organisationName,
                    });
                    setInvitePending(false);
                  }
                  setShowAddPatient(false);
                  setNewName("");
                  setNewSetting("");
                  setNewEmail("");
                  navigate("/");
                }}
              >
                {invitePending ? "Sending invite…" : "Add patient"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
