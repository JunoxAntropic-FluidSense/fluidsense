import type { FluidEvent, ReliabilityResult, ReliabilityLevel } from "../types";
import { differenceInHours, differenceInMinutes } from "date-fns";

const HEAVY_CONTINENCE = new Set(["wet_bed", "heavily_wet_pad", "leaking_pad"]);
const HEAVY_SWEAT = new Set(["heavy", "drenched"]);

export function computeReliability(
  windowEvents: FluidEvent[],
  periodLabel: string,
  periodStart: Date,
  periodEnd: Date
): ReliabilityResult {
  const reasons: string[] = [];
  const documentationGaps: string[] = [];
  const unresolvedWarnings: string[] = [];

  const active = windowEvents.filter((e) => !e.deleted);
  const intake = active.filter((e) => e.direction === "intake");
  const output = active.filter((e) => e.direction === "output");

  const unmeasuredUrine = output.filter(
    (e) => e.category === "urine" && e.status === "unmeasured"
  );
  const heavyContinence = active.filter(
    (e) => e.category === "continence" && HEAVY_CONTINENCE.has(e.subtype ?? "")
  );
  const unmeasuredVomit = output.filter(
    (e) => e.category === "vomit" && e.status === "unmeasured"
  );
  const unmeasuredDiarrhoea = output.filter(
    (e) => e.category === "diarrhoea" && e.status === "unmeasured"
  );
  const heavySweat = active.filter(
    (e) => e.category === "sweating" && HEAVY_SWEAT.has(e.subtype ?? "")
  );
  const containerEstimates = active.filter(
    (e) => e.status === "container_estimated" || e.status === "approximate"
  );
  const unmeasuredEvents = active.filter((e) => e.status === "unmeasured");

  const diarrhoeaEpisodeTotal = unmeasuredDiarrhoea.reduce(
    (n, e) => n + (e.episodeCount ?? 1),
    0
  );
  const urineEpisodeTotal = unmeasuredUrine.length;

  // --- Documentation gaps -------------------------------------------------
  const totalWindowHours = differenceInHours(periodEnd, periodStart) || 1;
  const intakeGapHours = largestGapHours(intake, periodStart, periodEnd);
  const outputGapHours = largestGapHours(output, periodStart, periodEnd);

  if (intakeGapHours >= 7) {
    documentationGaps.push(
      `there was a ${intakeGapHours}-hour gap in intake documentation`
    );
  }
  if (output.length === 0 && totalWindowHours >= 6) {
    documentationGaps.push("no output has been recorded in this period");
  } else if (outputGapHours >= 10) {
    documentationGaps.push(
      `no output has been recorded for ${outputGapHours} hours`
    );
  }

  // --- Duplicate / implausible checks ------------------------------------
  const duplicates = findLikelyDuplicates(active);
  if (duplicates.length > 0) {
    unresolvedWarnings.push(
      `possible duplicate entries detected (${duplicates.length})`
    );
  }
  const implausible = active.filter(
    (e) => typeof e.amountMl === "number" && e.amountMl > 2500
  );
  if (implausible.length > 0) {
    unresolvedWarnings.push(
      `${implausible.length} entry appears unusually large and has not been resolved`
    );
  }

  // --- Build reason strings -------------------------------------------------
  if (urineEpisodeTotal > 0) {
    reasons.push(
      `${urineEpisodeTotal} urine ${urineEpisodeTotal === 1 ? "episode was" : "episodes were"} not measured`
    );
  }
  if (heavyContinence.length > 0) {
    reasons.push(
      `${heavyContinence.length} heavily wet pad or wet bed event${heavyContinence.length > 1 ? "s were" : " was"} recorded as unmeasured`
    );
  }
  if (unmeasuredVomit.length > 0) {
    reasons.push(`vomiting was recorded without a measured volume`);
  }
  if (diarrhoeaEpisodeTotal > 0) {
    reasons.push(
      `${diarrhoeaEpisodeTotal} watery stool${diarrhoeaEpisodeTotal > 1 ? "s were" : " was"} recorded without a volume`
    );
  }
  if (heavySweat.length > 0) {
    reasons.push(
      "heavy sweating was recorded, which is not included in the numerical balance"
    );
  }
  documentationGaps.forEach((g) => reasons.push(g));
  unresolvedWarnings.forEach((w) => reasons.push(w));
  if (containerEstimates.length > 0 && reasons.length === 0) {
    reasons.push(
      `${containerEstimates.length} entr${containerEstimates.length > 1 ? "ies rely" : "y relies"} on container or approximate estimates rather than exact measurement`
    );
  }

  // --- Decide level --------------------------------------------------------
  const lowTriggers =
    urineEpisodeTotal >= 2 ||
    heavyContinence.length > 0 ||
    unmeasuredVomit.length > 0 ||
    diarrhoeaEpisodeTotal > 0 ||
    heavySweat.length > 0 ||
    intakeGapHours >= 10 ||
    outputGapHours >= 10 ||
    (output.length === 0 && totalWindowHours >= 8) ||
    unresolvedWarnings.length > 0;

  const moderateTriggers =
    containerEstimates.length >= 1 ||
    unmeasuredEvents.length >= 1 ||
    intakeGapHours > 6 ||
    outputGapHours > 6;

  let level: ReliabilityLevel;
  if (lowTriggers) level = "Low";
  else if (moderateTriggers) level = "Moderate";
  else level = "High";

  if (level === "High") {
    reasons.push(
      "most entries were measured with no significant gaps or unresolved warnings"
    );
  }

  return {
    periodLabel,
    level,
    reasons,
    unmeasuredEventCount: unmeasuredEvents.length,
    documentationGaps,
    unresolvedWarnings,
  };
}

function largestGapHours(events: FluidEvent[], start: Date, end: Date): number {
  const times = events
    .map((e) => new Date(e.eventTime).getTime())
    .sort((a, b) => a - b);
  const bounds = [start.getTime(), ...times, end.getTime()];
  let maxGapMs = 0;
  for (let i = 1; i < bounds.length; i++) {
    maxGapMs = Math.max(maxGapMs, bounds[i] - bounds[i - 1]);
  }
  return Math.floor(maxGapMs / (1000 * 60 * 60));
}

function findLikelyDuplicates(events: FluidEvent[]): FluidEvent[] {
  const dupes: FluidEvent[] = [];
  const sorted = [...events].sort(
    (a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime()
  );
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (
      a.category === b.category &&
      a.amountMl === b.amountMl &&
      a.direction === b.direction &&
      Math.abs(
        differenceInMinutes(new Date(b.eventTime), new Date(a.eventTime))
      ) <= 3
    ) {
      dupes.push(b);
    }
  }
  return dupes;
}
