import type { FluidCategory, OutputCategory } from "../types";

export const CATEGORY_ICON: Record<FluidCategory | OutputCategory, string> = {
  water: "💧",
  tea: "🍵",
  coffee: "☕",
  juice: "🧃",
  milk: "🥛",
  squash: "🥤",
  soup: "🥣",
  nutritional_drink: "🧴",
  ice: "🧊",
  enteral_feed: "🍽️",
  iv_fluid: "💉",
  iv_medication: "💉",
  other_intake: "➕",
  urine: "🚽",
  continence: "🩹",
  vomit: "🤢",
  diarrhoea: "🚻",
  stoma: "🩹",
  drain: "🩸",
  nasogastric: "🧪",
  sweating: "💦",
  other_output: "➖",
};

export const CATEGORY_LABEL: Record<FluidCategory | OutputCategory, string> = {
  water: "Water",
  tea: "Tea",
  coffee: "Coffee",
  juice: "Juice",
  milk: "Milk",
  squash: "Squash",
  soup: "Soup",
  nutritional_drink: "Nutritional drink",
  ice: "Ice",
  enteral_feed: "Enteral feed",
  iv_fluid: "IV fluid",
  iv_medication: "IV medication / flush",
  other_intake: "Other intake",
  urine: "Urine",
  continence: "Continence event",
  vomit: "Vomiting",
  diarrhoea: "Diarrhoea",
  stoma: "Stoma output",
  drain: "Drain output",
  nasogastric: "Nasogastric output",
  sweating: "Sweating",
  other_output: "Other output",
};

export const INTAKE_CATEGORIES: FluidCategory[] = [
  "water",
  "tea",
  "coffee",
  "juice",
  "milk",
  "squash",
  "soup",
  "nutritional_drink",
  "ice",
  "enteral_feed",
  "iv_fluid",
  "iv_medication",
  "other_intake",
];

export const OUTPUT_CATEGORIES: OutputCategory[] = [
  "urine",
  "continence",
  "vomit",
  "diarrhoea",
  "stoma",
  "drain",
  "nasogastric",
  "sweating",
  "other_output",
];

export const INPUT_METHOD_LABEL: Record<string, string> = {
  tap: "Quick tap",
  manual: "Manual entry",
  voice: "Voice entry",
};
export const INPUT_METHOD_ICON: Record<string, string> = {
  tap: "👆",
  manual: "⌨️",
  voice: "🎙️",
};
