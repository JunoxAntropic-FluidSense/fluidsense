import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { ReliabilityPill } from "../ui/ReliabilityPill";
import { Button } from "../ui/Button";
import { formatMl, formatMlPlain } from "../../lib/calc";
import type {
  BalanceBreakdown,
  ReliabilityResult,
  FluidEvent,
} from "../../types";
import { CATEGORY_LABEL } from "../../lib/eventMeta";
import { formatDistanceToNow } from "date-fns";

export function BalanceCard({
  balance,
  reliability,
  lastEvent,
  periodLabel,
}: {
  balance: BalanceBreakdown;
  reliability: ReliabilityResult;
  lastEvent?: FluidEvent;
  periodLabel: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold uppercase tracking-wide text-fog-500">
          {periodLabel}
        </h2>
        <ReliabilityPill level={reliability.level} />
      </div>

      <dl className="mt-3 space-y-2.5">
        <Row
          label="Recorded intake"
          value={formatMlPlain(balance.totalIntakeMl)}
          tone="intake"
        />
        <Row
          label="Measured output"
          value={formatMlPlain(balance.measuredOutputMl)}
          tone="output"
        />
        <Row
          label="Recorded balance"
          value={formatMl(balance.recordedBalanceMl)}
          strong
        />
        <Row
          label="Unmeasured events"
          value={String(balance.unmeasuredCount)}
          tone="fog"
        />
      </dl>

      {lastEvent && (
        <p className="mt-3 text-sm text-fog-600">
          Last recorded:{" "}
          <span className="font-semibold text-navy-800">
            {CATEGORY_LABEL[lastEvent.category]}
          </span>{" "}
          {formatDistanceToNow(new Date(lastEvent.eventTime), {
            addSuffix: true,
          })}
        </p>
      )}

      <Link to="/summary">
        <Button fullWidth variant="secondary" className="mt-4">
          View 24-hour summary
        </Button>
      </Link>
    </Card>
  );
}

function Row({
  label,
  value,
  tone = "navy",
  strong,
}: {
  label: string;
  value: string;
  tone?: "intake" | "output" | "navy" | "fog";
  strong?: boolean;
}) {
  const toneClass: Record<string, string> = {
    intake: "text-intake-700",
    output: "text-output-700",
    navy: "text-navy-900",
    fog: "text-fog-600",
  };
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-sm text-fog-600">{label}</dt>
      <dd
        className={`font-bold ${strong ? "text-xl" : "text-base"} ${toneClass[tone]}`}
      >
        {value}
      </dd>
    </div>
  );
}
