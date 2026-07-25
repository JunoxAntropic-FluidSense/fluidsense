import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { ReliabilityPill } from "../ui/ReliabilityPill";
import { Button } from "../ui/Button";
import { StatRow } from "../ui/StatRow";
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

      <div className="mt-4">
        <p className="text-4xl md:text-5xl font-extrabold text-navy-900 tabular-nums leading-none">
          {formatMl(balance.recordedBalanceMl)}
        </p>
        <p className="mt-1 text-sm text-fog-600">Recorded balance</p>
      </div>

      <dl className="mt-4 space-y-2.5 border-t border-navy-900/5 pt-3">
        <StatRow
          label="Recorded intake"
          value={formatMlPlain(balance.totalIntakeMl)}
          tone="intake"
        />
        <StatRow
          label="Measured output"
          value={formatMlPlain(balance.measuredOutputMl)}
          tone="output"
        />
        <StatRow
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
