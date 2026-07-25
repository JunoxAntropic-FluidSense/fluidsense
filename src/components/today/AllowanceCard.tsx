import { Card } from "../ui/Card";
import { ProgressBar } from "../ui/ProgressBar";
import type { FluidAllowance } from "../../types";
import { formatMlPlain } from "../../lib/calc";

export function AllowanceCard({
  allowance,
  recordedIntakeMl,
}: {
  allowance: FluidAllowance;
  recordedIntakeMl: number;
}) {
  const remaining = allowance.dailyMl - recordedIntakeMl;
  return (
    <Card className="p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-fog-500 mb-3">
        Fluid allowance
      </h2>
      <div className="space-y-2">
        <Row label="Daily allowance" value={formatMlPlain(allowance.dailyMl)} />
        <Row label="Recorded intake" value={formatMlPlain(recordedIntakeMl)} />
        <Row
          label="Remaining based on recorded intake"
          value={`${remaining >= 0 ? "" : "−"}${formatMlPlain(Math.abs(remaining))}`}
          strong={remaining < 0}
        />
      </div>
      <div className="mt-3">
        <ProgressBar value={recordedIntakeMl} max={allowance.dailyMl} />
      </div>
      <p className="mt-3 text-xs text-fog-500">
        Set by {allowance.setByName} ({roleLabel(allowance.setByRole)}), not
        calculated by the app.
      </p>
    </Card>
  );
}

function roleLabel(role: string) {
  return (
    {
      clinician: "clinician",
      nurse: "nurse",
      healthcare_assistant: "healthcare assistant",
      patient: "patient",
      family_carer: "family carer",
    }[role] ?? role
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-sm text-fog-600">{label}</span>
      <span
        className={`font-bold ${strong ? "text-alert-600" : "text-navy-900"}`}
      >
        {value}
      </span>
    </div>
  );
}
