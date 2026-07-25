import type { FluidCategory, OutputCategory } from "../../types";

const INTAKE_CATEGORY_MAP: [RegExp, FluidCategory][] = [
  [/\bcoffee\b/, "coffee"],
  [/\btea\b/, "tea"],
  [/\bjuice\b/, "juice"],
  [/\bmilk\b/, "milk"],
  [/\bsquash\b/, "squash"],
  [/\bsoup\b/, "soup"],
  [
    /\b(shake|nutritional drink|supplement drink|ensure)\b/,
    "nutritional_drink",
  ],
  [/\bice chips?\b|\bice\b/, "ice"],
  [/\b(enteral feed|feed given|\bfeed\b)\b/, "enteral_feed"],
  [/\b(saline|dextrose|iv fluid|iv drip|iv infusion)\b/, "iv_fluid"],
  [/\b(iv medication|flush given|\bflush\b)\b/, "iv_medication"],
  [/\bwater\b/, "water"],
];

const OUTPUT_CATEGORY_MAP: [RegExp, OutputCategory][] = [
  [
    /\b(urine|wee|pee|peed|peeing|urinated|passed water|passed urine|opened (my |his |her |their )?bladder|catheter|bag drained|emptied.*urine bottle|toilet)\b/,
    "urine",
  ],
  [/\b(wet pad|wet bed|wet clothing|incontinent|\bpad\b)\b/, "continence"],
  [/\b(vomit|vomited|vomiting|was sick|threw up|throwing up)\b/, "vomit"],
  [
    /\b(diarrhoea|diarrhea|watery stools?|loose stools?|\bstool\b)\b/,
    "diarrhoea",
  ],
  [/\bstoma\b/, "stoma"],
  [/\bdrain\b/, "drain"],
  [/\b(nasogastric|ng (tube|output|aspirate))\b/, "nasogastric"],
  [/\bsweat/, "sweating"],
];

export function detectIntakeCategory(text: string): FluidCategory | null {
  const t = text.toLowerCase();
  for (const [re, cat] of INTAKE_CATEGORY_MAP) if (re.test(t)) return cat;
  return null;
}

export function detectOutputCategory(text: string): OutputCategory | null {
  const t = text.toLowerCase();
  for (const [re, cat] of OUTPUT_CATEGORY_MAP) if (re.test(t)) return cat;
  return null;
}
