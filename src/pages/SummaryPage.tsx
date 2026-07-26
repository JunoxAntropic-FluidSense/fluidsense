import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFluidData } from "../hooks/useFluidData";
import { useStore } from "../store/useStore";
import { Card, CardHeading } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ReliabilityPill } from "../components/ui/ReliabilityPill";
import { Field, Select } from "../components/ui/Field";
import { NoActivePatientState } from "../components/ui/NoActivePatientState";
import { DateRangePicker } from "../components/ui/DateRangePicker";
import { WeatherNote } from "../components/today/WeatherNote";
import { PERIOD_OPTIONS } from "../lib/period";
import {
  formatMl,
  formatMlPlain,
  describeUnmeasured,
  eventsInWindow,
  computeBalance,
} from "../lib/calc";
import { isSupabaseConfigured } from "../lib/supabase/client";
import { sendCareTeamSummary } from "../lib/careTeam/sendSummary";
import { format, startOfDay, endOfDay, subDays, isToday } from "date-fns";
import { DIALYSIS_MODALITY_LABEL } from "../types";
import type { SummaryPeriod } from "../types";

export function SummaryPage() {
  const navigate = useNavigate();
  const {
    patient,
    period,
    setPeriod,
    customRange,
    setCustomRange,
    balance,
    reliability,
    windowEvents,
    range,
  } = useFluidData("24h");
  const allEvents = useStore((s) => s.events);
  const weightEvents = useStore((s) => s.weightEvents);
  const medicationEvents = useStore((s) => s.medicationEvents);
  const dialysisAppointments = useStore((s) => s.dialysisAppointments);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResultMessage, setSendResultMessage] = useState<string | null>(
    null
  );

  const patientWeights = useMemo(
    () =>
      weightEvents
        .filter((w) => w.patientId === patient?.id)
        .sort(
          (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
        ),
    [weightEvents, patient]
  );
  const weightChange =
    patientWeights.length >= 2
      ? patientWeights[0].weightKg - patientWeights[1].weightKg
      : undefined;

  const last7Days = useMemo(() => {
    if (!patient) return [];
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const day = subDays(today, i);
      const dayEvents = eventsInWindow(
        allEvents,
        patient.id,
        startOfDay(day),
        endOfDay(day)
      );
      return { date: day, balance: computeBalance(dayEvents) };
    });
  }, [allEvents, patient]);

  const unmeasuredDescriptions = useMemo(
    () => describeUnmeasured(balance.unmeasuredEvents),
    [balance.unmeasuredEvents]
  );

  const patientMedications = useMemo(
    () =>
      medicationEvents
        .filter((m) => m.patientId === patient?.id)
        .sort(
          (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
        ),
    [medicationEvents, patient]
  );
  const patientDialysis = useMemo(
    () =>
      dialysisAppointments
        .filter((d) => d.patientId === patient?.id)
        .sort(
          (a, b) =>
            new Date(b.scheduledTime).getTime() -
            new Date(a.scheduledTime).getTime()
        )
        .slice(0, 5),
    [dialysisAppointments, patient]
  );

  if (!patient) return <NoActivePatientState />;

  const allowanceRemainingMl = patient.allowance
    ? patient.allowance.dailyMl - balance.totalIntakeMl
    : 0;

  const summaryText = buildSummaryText();

  function buildSummaryText() {
    if (!patient) return "";
    const lines = [
      `Fluid summary — ${range.label}`,
      "",
      `Recorded oral intake: ${formatMlPlain(balance.oralIntakeMl)}`,
      `Recorded IV intake: ${formatMlPlain(balance.ivIntakeMl)}`,
      `Total recorded intake: ${formatMlPlain(balance.totalIntakeMl)} (measured ${formatMlPlain(balance.measuredIntakeMl)}, estimated ${formatMlPlain(balance.estimatedIntakeMl)})`,
      "",
      `Total recorded numerical output: ${formatMlPlain(balance.totalNumericOutputMl)} (measured ${formatMlPlain(balance.measuredOutputMl)}, estimated ${formatMlPlain(balance.estimatedOutputMl)})`,
      "",
      `Recorded balance: ${formatMl(balance.recordedBalanceMl)}`,
      "",
      "Unmeasured events:",
      ...(unmeasuredDescriptions.length
        ? unmeasuredDescriptions.map((d) => `- ${d}`)
        : ["- none recorded"]),
      "",
      `Reliability: ${reliability.level}`,
      "Reasons:",
      ...reliability.reasons.map((r) => `- ${r}`),
      "",
      ...(patient.allowance
        ? [
            "Fluid allowance:",
            `- clinician-set allowance: ${formatMlPlain(patient.allowance.dailyMl)}`,
            `- recorded intake: ${formatMlPlain(balance.totalIntakeMl)}`,
            `- remaining based on recorded intake: ${allowanceRemainingMl >= 0 ? "" : "−"}${formatMlPlain(Math.abs(allowanceRemainingMl))}`,
            "",
          ]
        : []),
      ...(weightChange !== undefined
        ? [
            `Weight change since previous reading: ${weightChange >= 0 ? "+" : ""}${weightChange.toFixed(1)} kg`,
            "",
          ]
        : []),
      ...(patientMedications.length
        ? [
            "Medications:",
            ...patientMedications.map(
              (m) => `- ${m.name}, ${m.dose}, ${m.frequency}`
            ),
            "",
          ]
        : []),
      ...(patientDialysis.length
        ? [
            "Recent dialysis / renal replacement therapy:",
            ...patientDialysis.map(
              (d) =>
                `- ${DIALYSIS_MODALITY_LABEL[d.modality]}, ${format(new Date(d.scheduledTime), "d MMM, HH:mm")}, ${d.attended ? "attended" : "missed"}`
            ),
            "",
          ]
        : []),
      "This summary describes recorded information and does not determine the patient's actual fluid status.",
    ];
    return lines.join("\n");
  }

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const canSendReal =
    isSupabaseConfigured() &&
    !!patient.careTeamShareConsent &&
    (patient.careTeamContacts?.length ?? 0) > 0;

  const shareWithCareTeam = async () => {
    if (!canSendReal) {
      await copySummary();
      return;
    }
    setSending(true);
    setSendResultMessage(null);
    const result = await sendCareTeamSummary({
      recipients: patient.careTeamContacts!,
      patientDisplayName: patient.displayName,
      summaryText,
    });
    setSending(false);
    if (result.status === "ok") {
      setSendResultMessage(
        `Sent to ${result.sent} contact${result.sent === 1 ? "" : "s"}.`
      );
    } else {
      setSendResultMessage("Couldn't send right now — please try again.");
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Fluid summary</h1>
        <p className="text-sm text-fog-600">
          {patient.displayName} · {range.label}
        </p>
      </div>

      <Field label="Period">
        <Select
          value={period}
          onChange={(e) => setPeriod(e.target.value as SummaryPeriod)}
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>

      {period === "custom" && (
        <Field label="Custom date range">
          <DateRangePicker
            from={customRange?.start}
            to={customRange?.end}
            onChange={(r) =>
              setCustomRange(
                r.from && r.to ? { start: r.from, end: r.to } : undefined
              )
            }
          />
        </Field>
      )}

      <WeatherNote />

      <Card className="p-5">
        <CardHeading action={<ReliabilityPill level={reliability.level} />}>
          Intake &amp; output
        </CardHeading>
        <dl className="space-y-2">
          <Row
            label="Recorded oral intake"
            value={formatMlPlain(balance.oralIntakeMl)}
          />
          <Row
            label="Recorded IV intake"
            value={formatMlPlain(balance.ivIntakeMl)}
          />
          <Row
            label="— measured intake"
            value={formatMlPlain(balance.measuredIntakeMl)}
            indent
          />
          <Row
            label="— estimated intake"
            value={formatMlPlain(balance.estimatedIntakeMl)}
            indent
          />
          <Row
            label="Total recorded intake"
            value={formatMlPlain(balance.totalIntakeMl)}
            strong
          />
          <div className="h-px bg-navy-900/10 my-2" />
          <Row
            label="Measured output"
            value={formatMlPlain(balance.measuredOutputMl)}
          />
          <Row
            label="Estimated numerical output"
            value={formatMlPlain(balance.estimatedOutputMl)}
          />
          <Row
            label="Total recorded numerical output"
            value={formatMlPlain(balance.totalNumericOutputMl)}
            strong
          />
          <div className="h-px bg-navy-900/10 my-2" />
          <Row
            label="Recorded balance"
            value={formatMl(balance.recordedBalanceMl)}
            strong
            big
          />
        </dl>
      </Card>

      <Card className="p-5">
        <CardHeading>Last 7 days</CardHeading>
        <p className="text-sm text-fog-600 mb-2">
          Recorded net balance per calendar day (total intake minus total
          numerical output) — not related to the period selected above.
        </p>
        <ul className="divide-y divide-navy-900/5">
          {last7Days.map(({ date, balance: dayBalance }) => (
            <li
              key={date.toISOString()}
              className="flex items-center justify-between py-2"
            >
              <span className="text-sm text-navy-800">
                {isToday(date) ? "Today" : format(date, "EEE d MMM")}
              </span>
              <span className="font-bold text-navy-900">
                {formatMl(dayBalance.recordedBalanceMl)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <CardHeading>Unmeasured events ({balance.unmeasuredCount})</CardHeading>
        {unmeasuredDescriptions.length === 0 ? (
          <p className="text-sm text-fog-600">
            No unmeasured events in this period.
          </p>
        ) : (
          <ul className="list-disc list-inside text-sm text-fog-700 space-y-1">
            {unmeasuredDescriptions.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
        <p className="text-xs text-fog-500 mt-2">
          Unmeasured events are not included in the numerical balance above.
        </p>
      </Card>

      <Card className="p-5">
        <CardHeading>Reliability: {reliability.level}</CardHeading>
        <p className="text-sm text-fog-600 mb-2">
          This reflects how complete the recorded data is — not the patient's
          medical condition.
        </p>
        <ul className="list-disc list-inside text-sm text-fog-700 space-y-1">
          {reliability.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </Card>

      {patient.allowance && (
        <Card className="p-5">
          <CardHeading>Fluid allowance</CardHeading>
          <Row
            label="Clinician-set allowance"
            value={formatMlPlain(patient.allowance.dailyMl)}
          />
          <Row
            label="Recorded intake"
            value={formatMlPlain(balance.totalIntakeMl)}
          />
          <Row
            label="Remaining based on recorded intake"
            value={`${allowanceRemainingMl >= 0 ? "" : "−"}${formatMlPlain(Math.abs(allowanceRemainingMl))}`}
            strong
          />
          <p className="text-xs text-fog-500 mt-2">
            Set by {patient.allowance.setByName}, not calculated by the app.
          </p>
        </Card>
      )}

      {weightChange !== undefined && (
        <Card className="p-5">
          <CardHeading>Weight</CardHeading>
          <p className="text-sm text-navy-800">
            Latest: {patientWeights[0].weightKg} kg (
            {format(new Date(patientWeights[0].time), "d MMM, HH:mm")})
          </p>
          <p className="text-sm text-fog-600">
            Change since previous reading: {weightChange >= 0 ? "+" : ""}
            {weightChange.toFixed(1)} kg
          </p>
        </Card>
      )}

      {(patientMedications.length > 0 || patientDialysis.length > 0) && (
        <Card className="p-5">
          <CardHeading>Medications &amp; dialysis</CardHeading>
          {patientMedications.length > 0 && (
            <ul className="text-sm text-navy-800 space-y-1 mb-2">
              {patientMedications.slice(0, 5).map((m) => (
                <li key={m.id}>
                  {m.name} — {m.dose}, {m.frequency}
                </li>
              ))}
            </ul>
          )}
          {patientDialysis.length > 0 && (
            <ul className="text-sm text-fog-600 space-y-1">
              {patientDialysis.map((d) => (
                <li key={d.id}>
                  {DIALYSIS_MODALITY_LABEL[d.modality]},{" "}
                  {format(new Date(d.scheduledTime), "d MMM, HH:mm")} —{" "}
                  {d.attended ? "attended" : "missed"}
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/care-log"
            className="text-xs font-semibold underline text-navy-700 mt-2 inline-block"
          >
            Open full log
          </Link>
        </Card>
      )}

      <Card className="p-5 bg-navy-900 text-fog-100">
        <p className="text-sm font-semibold">
          This summary describes recorded information and does not determine the
          patient's actual fluid status.
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={copySummary}>
          {copied ? "Copied ✓" : "Copy summary"}
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          Print / Download
        </Button>
        <Button
          variant="secondary"
          onClick={shareWithCareTeam}
          disabled={sending}
        >
          {sending
            ? "Sending…"
            : canSendReal
              ? "Send to care team"
              : "Share with healthcare team"}
        </Button>
        <Button onClick={() => navigate("/")}>Return to Today</Button>
      </div>
      {sendResultMessage && (
        <p className="text-xs text-center text-navy-700" aria-live="polite">
          {sendResultMessage}
        </p>
      )}
      <p className="text-xs text-fog-500 text-center">
        {canSendReal
          ? "This sends your summary above to the contacts you've added in Profile → Care team sharing."
          : '"Share" copies formatted text in this prototype rather than sending real clinical data.'}
      </p>

      <p className="sr-only" aria-live="polite">
        {windowEvents.length} events in this period.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  big,
  indent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  big?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between ${indent ? "pl-3" : ""}`}
    >
      <dt className="text-sm text-fog-600">{label}</dt>
      <dd
        className={`font-bold text-navy-900 ${big ? "text-2xl" : strong ? "text-base" : "text-sm font-semibold"}`}
      >
        {value}
      </dd>
    </div>
  );
}
