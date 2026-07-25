import type { FluidEvent, BalanceBreakdown } from "../types";
import { isWithinInterval } from "date-fns";

const IV_CATEGORIES = new Set(["iv_fluid", "iv_medication"]);

export function eventsInWindow(
  events: FluidEvent[],
  patientId: string,
  start: Date,
  end: Date
): FluidEvent[] {
  return events
    .filter((e) => !e.deleted && e.patientId === patientId)
    .filter((e) => isWithinInterval(new Date(e.eventTime), { start, end }))
    .sort(
      (a, b) =>
        new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime()
    );
}

export function computeBalance(events: FluidEvent[]): BalanceBreakdown {
  let measuredIntakeMl = 0;
  let estimatedIntakeMl = 0;
  let oralIntakeMl = 0;
  let ivIntakeMl = 0;
  let measuredOutputMl = 0;
  let estimatedOutputMl = 0;
  const unmeasuredEvents: FluidEvent[] = [];

  for (const e of events) {
    const isNumeric =
      typeof e.amountMl === "number" && e.status !== "unmeasured";
    if (e.direction === "intake") {
      if (isNumeric) {
        const amt = e.amountMl!;
        if (e.status === "measured") measuredIntakeMl += amt;
        else estimatedIntakeMl += amt; // container_estimated | approximate

        if (IV_CATEGORIES.has(e.category)) ivIntakeMl += amt;
        else oralIntakeMl += amt;
      } else {
        unmeasuredEvents.push(e);
      }
    } else {
      // output
      if (isNumeric) {
        const amt = e.amountMl!;
        if (e.status === "measured") measuredOutputMl += amt;
        else estimatedOutputMl += amt;
      } else {
        unmeasuredEvents.push(e);
      }
    }
  }

  const totalIntakeMl = measuredIntakeMl + estimatedIntakeMl;
  const totalNumericOutputMl = measuredOutputMl + estimatedOutputMl;

  return {
    measuredIntakeMl,
    estimatedIntakeMl,
    totalIntakeMl,
    oralIntakeMl,
    ivIntakeMl,
    measuredOutputMl,
    estimatedOutputMl,
    totalNumericOutputMl,
    recordedBalanceMl: totalIntakeMl - totalNumericOutputMl,
    unmeasuredEvents,
    unmeasuredCount: unmeasuredEvents.length,
  };
}

export function describeUnmeasured(events: FluidEvent[]): string[] {
  const groups = new Map<string, number>();
  for (const e of events) {
    const key = unmeasuredLabel(e);
    groups.set(key, (groups.get(key) ?? 0) + (e.episodeCount ?? 1));
  }
  return Array.from(groups.entries()).map(([label, count]) => {
    if (count <= 1) return label;
    return `${count} × ${label}`;
  });
}

function unmeasuredLabel(e: FluidEvent): string {
  switch (e.category) {
    case "urine":
      return "urine episode (unmeasured)";
    case "continence":
      return e.subtype ? `${e.subtype.replace(/_/g, " ")}` : "continence event";
    case "vomit":
      return "vomiting (unmeasured)";
    case "diarrhoea":
      return "watery stool (unmeasured)";
    case "sweating":
      return `sweating (${e.subtype ?? "unspecified"})`;
    case "stoma":
      return "stoma output (unmeasured)";
    case "drain":
      return "drain output (unmeasured)";
    default:
      return `${e.category.replace(/_/g, " ")} (unmeasured)`;
  }
}

export function formatMl(ml: number, units: "mL" | "L" = "mL"): string {
  const sign = ml > 0 ? "+" : "";
  if (units === "L") return `${sign}${(ml / 1000).toFixed(2)} L`;
  return `${sign}${Math.round(ml).toLocaleString()} mL`;
}

export function formatMlPlain(ml: number, units: "mL" | "L" = "mL"): string {
  if (units === "L") return `${(ml / 1000).toFixed(2)} L`;
  return `${Math.round(ml).toLocaleString()} mL`;
}
