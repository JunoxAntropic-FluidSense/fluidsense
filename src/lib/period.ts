import type { SummaryPeriod, PatientProfile, MonitoringPeriod } from "../types";
import { subHours, subDays, startOfDay, format, isSameDay } from "date-fns";

export interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
}

const SHIFT_START_HOUR = 7; // 07:00 day shift start, 19:00 night shift start

interface PeriodOpts {
  custom?: { start: Date; end: Date };
  patient?: PatientProfile;
  activePeriod?: MonitoringPeriod | null;
}

function monitoringDayStart(
  now: Date,
  patient?: PatientProfile,
  activePeriod?: MonitoringPeriod | null
): { start: Date; label: string } {
  const mode = patient?.monitoringDayStartMode ?? "midnight";
  const manualStart =
    activePeriod?.status === "active" ? new Date(activePeriod.startTime) : null;

  // "Start new day" always overrides the natural boundary — it only stops
  // applying once a later natural boundary (the next midnight/custom hour)
  // has since passed, at which point the automatic schedule takes back over.
  if (mode === "on_demand") {
    if (manualStart)
      return {
        start: manualStart,
        label: `Current monitoring day (started ${format(manualStart, "HH:mm")})`,
      };
    return {
      start: startOfDay(now),
      label: "Current monitoring day (from midnight)",
    };
  }

  let naturalStart: Date;
  let label: string;
  if (mode === "custom_time") {
    const hour = patient?.monitoringDayCustomHour ?? 6;
    naturalStart = new Date(now);
    naturalStart.setHours(hour, 0, 0, 0);
    if (naturalStart > now) naturalStart.setDate(naturalStart.getDate() - 1);
    label = `Current monitoring day (from ${String(hour).padStart(2, "0")}:00)`;
  } else {
    naturalStart = startOfDay(now);
    label = "Current monitoring day (from midnight)";
  }

  if (manualStart && manualStart > naturalStart) {
    return {
      start: manualStart,
      label: `Current monitoring day (started ${format(manualStart, "HH:mm")})`,
    };
  }
  return { start: naturalStart, label };
}

export function getPeriodRange(
  period: SummaryPeriod,
  now: Date,
  opts: PeriodOpts = {}
): PeriodRange {
  switch (period) {
    case "6h":
      return { start: subHours(now, 6), end: now, label: "Last 6 hours" };
    case "12h":
      return { start: subHours(now, 12), end: now, label: "Last 12 hours" };
    case "24h":
      return {
        start: subHours(now, 24),
        end: now,
        label: "Rolling last 24 hours",
      };
    case "since_midnight":
      return {
        start: startOfDay(now),
        end: now,
        label: "Today since midnight",
      };
    case "previous_day": {
      const start = startOfDay(subDays(now, 1));
      const end = startOfDay(now);
      return {
        start,
        end,
        label: `Previous calendar day (${format(start, "d MMM")})`,
      };
    }
    case "monitoring_day": {
      const { start, label } = monitoringDayStart(
        now,
        opts.patient,
        opts.activePeriod
      );
      return { start, end: now, label };
    }
    case "shift": {
      const hour = now.getHours();
      const isDayShift = hour >= SHIFT_START_HOUR && hour < 19;
      const start = new Date(now);
      if (isDayShift) start.setHours(SHIFT_START_HOUR, 0, 0, 0);
      else if (hour >= 19) start.setHours(19, 0, 0, 0);
      else {
        start.setDate(start.getDate() - 1);
        start.setHours(19, 0, 0, 0);
      }
      return {
        start,
        end: now,
        label: isDayShift ? "Current shift (day)" : "Current shift (night)",
      };
    }
    case "custom":
      return {
        start: opts.custom?.start ?? subHours(now, 24),
        end: opts.custom?.end ?? now,
        label: "Custom range",
      };
    default:
      return {
        start: subHours(now, 24),
        end: now,
        label: "Rolling last 24 hours",
      };
  }
}

// A precise "14:30 yesterday to 14:30 today" style label for display above summaries.
export function formatPeriodRangeLabel(range: PeriodRange, now: Date): string {
  const dayWord = (d: Date) =>
    isSameDay(d, now)
      ? "today"
      : isSameDay(d, subDays(now, 1))
        ? "yesterday"
        : format(d, "d MMM");
  return `${format(range.start, "HH:mm")} ${dayWord(range.start)} to ${format(range.end, "HH:mm")} ${dayWord(range.end)}`;
}

export const PERIOD_OPTIONS: { value: SummaryPeriod; label: string }[] = [
  { value: "monitoring_day", label: "Current monitoring day" },
  { value: "24h", label: "Rolling last 24 hours" },
  { value: "shift", label: "Current shift" },
  { value: "6h", label: "Last 6 hours" },
  { value: "12h", label: "Last 12 hours" },
  { value: "since_midnight", label: "Today since midnight" },
  { value: "previous_day", label: "Previous calendar day" },
  { value: "custom", label: "Custom range" },
];
