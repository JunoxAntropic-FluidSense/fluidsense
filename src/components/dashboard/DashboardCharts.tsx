import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { subDays, startOfDay, format, isSameDay } from "date-fns";
import { Card, CardHeading } from "../ui/Card";
import type { FluidEvent, ReliabilityLevel } from "../../types";

const RELIABILITY_COLORS: Record<ReliabilityLevel, string> = {
  High: "var(--color-intake-600)",
  Moderate: "var(--color-amber-600)",
  Low: "var(--color-alert-500)",
};
const RELIABILITY_ORDER: ReliabilityLevel[] = ["High", "Moderate", "Low"];

// Both charts describe recorded-data facts (how complete the record is, how
// much documentation is happening) — never a clinical trend about the
// patients themselves. See CLAUDE.md hard rule 2.

export function ReliabilityDistributionChart({
  levels,
}: {
  levels: ReliabilityLevel[];
}) {
  const data = useMemo(() => {
    const counts: Record<ReliabilityLevel, number> = {
      High: 0,
      Moderate: 0,
      Low: 0,
    };
    levels.forEach((l) => {
      counts[l] += 1;
    });
    return RELIABILITY_ORDER.map((level) => ({ level, count: counts[level] }));
  }, [levels]);

  return (
    <Card className="p-5">
      <CardHeading>Reliability across patients</CardHeading>
      <p className="text-xs text-fog-500 mb-3">
        How complete each patient's recorded data is over the last 24 hours —
        not a measure of their condition.
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="var(--color-fog-200)"
          />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="level"
            width={70}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--color-fog-200)",
              fontSize: 13,
            }}
          />
          <Bar dataKey="count" name="Patients" radius={[0, 8, 8, 0]}>
            {data.map((d) => (
              <Cell key={d.level} fill={RELIABILITY_COLORS[d.level]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function EntriesTrendChart({
  events,
  patientIds,
}: {
  events: FluidEvent[];
  patientIds: string[];
}) {
  const data = useMemo(() => {
    const idSet = new Set(patientIds);
    const days = Array.from({ length: 7 }, (_, i) =>
      startOfDay(subDays(new Date(), 6 - i))
    );
    return days.map((day) => {
      const dayEvents = events.filter(
        (e) =>
          !e.deleted &&
          idSet.has(e.patientId) &&
          isSameDay(new Date(e.eventTime), day)
      );
      return {
        day: format(day, "d MMM"),
        intake: dayEvents.filter((e) => e.direction === "intake").length,
        output: dayEvents.filter((e) => e.direction === "output").length,
      };
    });
  }, [events, patientIds]);

  return (
    <Card className="p-5">
      <CardHeading>Recorded entries, last 7 days</CardHeading>
      <p className="text-xs text-fog-500 mb-3">
        Count of intake and output events recorded across your patients each
        day.
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={data}
          margin={{ left: -20, right: 8, top: 4, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--color-fog-200)"
          />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--color-fog-200)",
              fontSize: 13,
            }}
          />
          <Bar
            dataKey="intake"
            name="Intake events"
            stackId="a"
            fill="var(--color-intake-500)"
          />
          <Bar
            dataKey="output"
            name="Output events"
            stackId="a"
            fill="var(--color-output-500)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
