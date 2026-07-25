import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFluidData } from "../hooks/useFluidData";
import { useStore } from "../store/useStore";
import { Card, CardHeading } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ReliabilityPill } from "../components/ui/ReliabilityPill";
import { WeatherNote } from "../components/today/WeatherNote";
import { PERIOD_OPTIONS } from "../lib/period";
import { formatMl, formatMlPlain, describeUnmeasured } from "../lib/calc";
import { format } from "date-fns";
import type { SummaryPeriod } from "../types";

export function SummaryPage() {
  const navigate = useNavigate();
  const {
    patient,
    period,
    setPeriod,
    balance,
    reliability,
    windowEvents,
    range,
  } = useFluidData("24h");
  const weightEvents = useStore((s) => s.weightEvents);
  const [copied, setCopied] = useState(false);

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

  const unmeasuredDescriptions = useMemo(
    () => describeUnmeasured(balance.unmeasuredEvents),
    [balance.unmeasuredEvents]
  );

  if (!patient) return null;

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
            "",
          ]
        : []),
      ...(weightChange !== undefined
        ? [
            `Weight change since previous reading: ${weightChange >= 0 ? "+" : ""}${weightChange.toFixed(1)} kg`,
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

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Fluid summary</h1>
        <p className="text-sm text-fog-600">
          {patient.displayName} · {range.label}
        </p>
      </div>

      <label className="block text-sm font-semibold text-navy-700">
        Period
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as SummaryPeriod)}
          className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal bg-white"
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

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
        <Button variant="secondary" onClick={copySummary}>
          Share with healthcare team
        </Button>
        <Button onClick={() => navigate("/")}>Return to Today</Button>
      </div>
      <p className="text-xs text-fog-500 text-center">
        "Share" copies formatted text in this prototype rather than sending real
        clinical data.
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
