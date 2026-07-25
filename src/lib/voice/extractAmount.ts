import type { MeasurementStatus } from "../../types";
import {
  wordsToNumber,
  NUMBER_PHRASE_RE,
  isHedgedQuantity,
} from "./numberWords";
import {
  detectUnit,
  toMl,
  stripUnitWord,
  type CanonicalUnit,
} from "./unitNormalize";

export interface AmountExtraction {
  amountMl?: number;
  rawValue?: number;
  rawUnit?: CanonicalUnit | "cup" | null;
  status: MeasurementStatus;
  containerFraction?: number;
  containerNameHint?: string; // e.g. "mug", "bottle", "carton" — resolved against saved containers by the caller
  ambiguityNote?: string;
  matchedText: string;
}

const FRACTION_WORDS: [RegExp, number][] = [
  [/\bthree[\s-]quarters?\b/, 0.75],
  [/\ba quarter\b|\bquarter\b/, 0.25],
  [/\bhalf\b/, 0.5],
  [/\b(nearly full|almost full)\b/, 0.9],
  [/\bmostly full\b/, 0.8],
  [/\bhalf empty\b/, 0.5],
  [/\b(full|finished|whole|all of it|all of)\b/, 1],
];

const CONTAINER_WORDS = /\b(bottle|mug|cup|glass|bowl|carton|can|jug|beaker)\b/;

const SIP_RE = /\ba few sips?\b/;
const SINGLE_SIP_RE = /\ba sip\b/;

// Bare digit + unit, e.g. "250 mL", "500ml", "1.5 l"
const DIGIT_UNIT_RE =
  /(\d+(?:\.\d+)?)\s*(ml|mls|mil|mils|mill|mills|millilitre|millilitres|milliliter|milliliters|cc|ccs|l|litre|litres|liter|liters)\b/i;

/**
 * Finds the best amount interpretation within a short clause (already
 * isolated by the caller — see extractEvents.ts for sentence segmentation).
 * Returns null if no amount language was found at all (caller should treat
 * the event as unmeasured pending explicit confirmation).
 */
export function extractAmount(clause: string): AmountExtraction | null {
  const text = clause.toLowerCase();

  // 1. Fraction-of-container phrasing takes priority over any bare digit+unit
  // elsewhere in the clause, since that number usually describes the
  // container's full size, not the consumed amount ("half my 500 mL bottle").
  for (const [re, fraction] of FRACTION_WORDS) {
    if (re.test(text)) {
      const containerWord = CONTAINER_WORDS.exec(text)?.[0];
      const sizeMatch = text.match(DIGIT_UNIT_RE);
      if (sizeMatch) {
        const value = parseFloat(sizeMatch[1]);
        const sizeUnit = detectUnit(sizeMatch[2]) ?? "mL";
        return {
          amountMl: Math.round(toMl(value, sizeUnit) * fraction),
          status: "container_estimated",
          containerFraction: fraction,
          containerNameHint: containerWord,
          matchedText: re.exec(text)?.[0] ?? "",
        };
      }
      return {
        status: "container_estimated",
        containerFraction: fraction,
        containerNameHint: containerWord,
        ambiguityNote: containerWord ? undefined : "Which container was this?",
        matchedText: re.exec(text)?.[0] ?? "",
      };
    }
  }

  // 2. Explicit digits + unit — highest confidence, always "measured" unless hedged.
  const digitMatch = text.match(DIGIT_UNIT_RE);
  if (digitMatch) {
    const value = parseFloat(digitMatch[1]);
    const unit = detectUnit(digitMatch[2]) ?? "mL";
    const hedged = isHedgedQuantity(text);
    return {
      amountMl: toMl(value, unit),
      rawValue: value,
      rawUnit: unit,
      status: hedged ? "approximate" : "measured",
      matchedText: digitMatch[0],
    };
  }

  // 3. Spoken number + unit, e.g. "two fifty mils", "twelve hundred ml".
  const unit = detectUnit(text);
  if (unit) {
    const withoutUnit = stripUnitWord(text);
    const numberMatches = Array.from(withoutUnit.matchAll(NUMBER_PHRASE_RE));
    if (numberMatches.length > 0) {
      // Prefer the match closest to where the unit appeared in the original text.
      const best = numberMatches[numberMatches.length - 1];
      const value = wordsToNumber(best[0]);
      if (value !== null) {
        const hedged = isHedgedQuantity(text);
        const ambiguity =
          /\b\w+\s+(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/.test(
            best[0]
          )
            ? `We interpreted "${best[0].trim()}" as ${value}. Please confirm.`
            : undefined;
        return {
          amountMl: toMl(value, unit),
          rawValue: value,
          rawUnit: unit,
          status: hedged ? "approximate" : "measured",
          ambiguityNote: ambiguity,
          matchedText: best[0],
        };
      }
    }
  }

  // 3. "X and a half cups" / "one cup and a half" — fractional cup counts.
  const andHalf = text.match(/\b(\w+)\s+(?:(\w+)\s+)?and a half\b/);
  if (andHalf) {
    const leadValue = wordsToNumber(andHalf[1]);
    if (leadValue !== null) {
      const containerWord =
        andHalf[2] && CONTAINER_WORDS.test(andHalf[2])
          ? andHalf[2]
          : CONTAINER_WORDS.exec(text)?.[0];
      return {
        rawValue: leadValue + 0.5,
        rawUnit: "cup",
        status: "approximate",
        containerNameHint: containerWord,
        matchedText: andHalf[0],
      };
    }
  }

  // 4. "One hospital cup", "a mug", "an bottle" — an implicit full serving of a named container.
  const oneContainer = text.match(
    /\b(?:a|an|one)\s+(?:\w+\s+){0,2}(bottle|mug|cup|glass|bowl|carton|can|jug|beaker)\b/
  );
  if (oneContainer) {
    return {
      status: "container_estimated",
      containerFraction: 1,
      containerNameHint: oneContainer[1],
      matchedText: oneContainer[0],
    };
  }

  // 5. Sips and other small qualitative approximates with no container reference.
  if (SIP_RE.test(text)) {
    return { amountMl: 60, status: "approximate", matchedText: "a few sips" };
  }
  if (SINGLE_SIP_RE.test(text)) {
    return { amountMl: 30, status: "approximate", matchedText: "a sip" };
  }

  // 6. A bare spoken/digit number with no unit at all — default to mL, but
  // flag the missing unit so the confirmation screen surfaces it. Skipped
  // when the number is actually an episode count ("two watery stools"),
  // which is not a volume.
  const bareNumberMatches = Array.from(text.matchAll(NUMBER_PHRASE_RE));
  for (let i = bareNumberMatches.length - 1; i >= 0; i--) {
    const best = bareNumberMatches[i];
    const trailing = text.slice(
      (best.index ?? 0) + best[0].length,
      (best.index ?? 0) + best[0].length + 30
    );
    if (
      /^\s*(episodes?|times|watery stools?|loose stools?|stools?)\b/.test(
        trailing
      )
    )
      continue;
    const value = wordsToNumber(best[0]);
    if (value !== null && value > 0) {
      return {
        amountMl: Math.round(value),
        rawValue: value,
        rawUnit: null,
        status: "approximate",
        ambiguityNote: `No unit was heard for "${best[0].trim()}" — please confirm mL or L.`,
        matchedText: best[0],
      };
    }
  }

  return null;
}
