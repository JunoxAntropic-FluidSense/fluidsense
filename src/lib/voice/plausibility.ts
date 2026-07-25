import type { Direction, FluidEvent, OutputCategory } from "../../types";
import { differenceInMinutes } from "date-fns";

// Non-diagnostic plausibility checks only — these flag possible transcription
// or entry errors for the user to double-check. They must never suggest a
// clinical interpretation (no "dehydrated", "fluid overloaded", "polyuria",
// "renal failure", diagnoses, or treatment advice of any kind).

export interface PlausibilityCandidate {
  direction: Direction;
  category: string;
  amountMl?: number;
  containerFullMl?: number;
  containerFraction?: number;
}

const BANNED_WORDS =
  /dehydrat|overload|polyuria|renal failure|aki\b|fluid status is|diagnos|prescri/i;

export function checkPlausibility(candidate: PlausibilityCandidate): string[] {
  const warnings: string[] = [];
  const { direction, category, amountMl, containerFullMl, containerFraction } =
    candidate;

  if (amountMl !== undefined && amountMl < 0) {
    warnings.push(
      "This entry has a negative amount, which is not possible. Please check the transcription."
    );
  }

  if (
    amountMl !== undefined &&
    direction === "intake" &&
    category !== "iv_fluid" &&
    amountMl > 2000
  ) {
    warnings.push(
      "This amount appears unusual for one drink. Please check the transcription."
    );
  }

  if (
    amountMl !== undefined &&
    direction === "output" &&
    category === "urine" &&
    amountMl > 3000
  ) {
    warnings.push(
      "This amount appears unusual for one urine output event. Please check the transcription."
    );
  }

  if (
    amountMl !== undefined &&
    containerFullMl &&
    containerFraction === 1 &&
    amountMl < containerFullMl * 0.5
  ) {
    warnings.push(
      `You said this container was full, but the recorded amount (${Math.round(amountMl)} mL) is much less than its usual ${containerFullMl} mL. Please check the transcription.`
    );
  }

  const result = warnings.filter((w) => !BANNED_WORDS.test(w));
  return result;
}

/** Finds a plausible duplicate of `candidate` recorded within the last 5 minutes. */
export function findDuplicate(
  candidate: {
    patientId: string;
    direction: Direction;
    category: string;
    amountMl?: number;
  },
  recentEvents: FluidEvent[],
  now: Date = new Date()
): FluidEvent | undefined {
  return recentEvents.find((e) => {
    if (e.deleted) return false;
    if (e.patientId !== candidate.patientId) return false;
    if (e.direction !== candidate.direction) return false;
    if (e.category !== candidate.category) return false;
    if (e.amountMl !== candidate.amountMl) return false;
    return Math.abs(differenceInMinutes(now, new Date(e.eventTime))) <= 5;
  });
}

export const OUTPUT_CATEGORIES_REQUIRING_AMOUNT_CHECK: OutputCategory[] = [
  "urine",
  "vomit",
  "stoma",
  "drain",
  "nasogastric",
];
