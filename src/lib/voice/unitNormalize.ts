// Volume-unit normalisation — every recognised spelling/mispronunciation of
// millilitres or litres, always resolved to a canonical amount in mL.

export type CanonicalUnit = "mL" | "L";

const ML_WORDS = [
  "ml",
  "mls",
  "mil",
  "mils",
  "mill",
  "mills",
  "millilitre",
  "millilitres",
  "milliliter",
  "milliliters",
  "cc",
  "ccs",
  "cubic centimetre",
  "cubic centimetres",
  "cubic centimeter",
  "cubic centimeters",
];
const L_WORDS = ["l", "litre", "litres", "liter", "liters"];

// Longest-first so "cubic centimetres" matches before any shorter overlap.
const ML_RE = new RegExp(
  `\\b(${[...ML_WORDS].sort((a, b) => b.length - a.length).join("|")})\\b`,
  "i"
);
const L_RE = new RegExp(
  `\\b(${[...L_WORDS].sort((a, b) => b.length - a.length).join("|")})\\b`,
  "i"
);

export function detectUnit(text: string): CanonicalUnit | null {
  if (ML_RE.test(text)) return "mL";
  if (L_RE.test(text)) return "L";
  return null;
}

export function toMl(value: number, unit: CanonicalUnit): number {
  return unit === "L" ? Math.round(value * 1000) : Math.round(value);
}

// Strips the unit word out of a phrase, leaving the number phrase behind —
// used once a unit has already been detected and consumed.
export function stripUnitWord(text: string): string {
  return text
    .replace(ML_RE, " ")
    .replace(L_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}
