import type { Icon, IconProps } from "@phosphor-icons/react";
import {
  Drop,
  TeaBag,
  Coffee,
  PintGlass,
  Jar,
  Martini,
  BowlFood,
  Flask,
  Snowflake,
  ForkKnife,
  Syringe,
  Pill,
  Plus,
  Toilet,
  Bandaids,
  Warning,
  WarningCircle,
  FirstAid,
  TestTube,
  SprayBottle,
  Waves,
  ArrowsClockwise,
  Minus,
  HandTap,
  Keyboard,
  Microphone,
  Heart,
  Lightning,
  Wine,
  CookingPot,
  Barbell,
} from "@phosphor-icons/react";
import type { FluidCategory, OutputCategory } from "../types";

export const CATEGORY_ICON: Record<FluidCategory | OutputCategory, Icon> = {
  water: Drop,
  tea: TeaBag,
  coffee: Coffee,
  juice: PintGlass,
  milk: Jar,
  squash: Martini,
  soup: BowlFood,
  smoothie: PintGlass,
  nutritional_drink: Flask,
  ice: Snowflake,
  enteral_feed: ForkKnife,
  iv_fluid: Syringe,
  iv_medication: Pill,
  sports_drink: Lightning,
  alcohol: Wine,
  broth: CookingPot,
  protein_shake: Barbell,
  other_intake: Plus,
  urine: Toilet,
  continence: Bandaids,
  menstrual_pad: Heart,
  vomit: Warning,
  diarrhoea: WarningCircle,
  stoma: FirstAid,
  drain: TestTube,
  nasogastric: SprayBottle,
  sweating: Waves,
  dialysis: ArrowsClockwise,
  other_output: Minus,
};

/** Wayfinding icon for a fluid category — the text label (CATEGORY_LABEL) carries the actual meaning. */
export function CategoryIcon({
  category,
  ...props
}: { category: FluidCategory | OutputCategory } & IconProps) {
  const IconComponent = CATEGORY_ICON[category];
  return <IconComponent {...props} />;
}

export const CATEGORY_LABEL: Record<FluidCategory | OutputCategory, string> = {
  water: "Water",
  tea: "Tea",
  coffee: "Coffee",
  juice: "Juice",
  milk: "Milk",
  squash: "Squash",
  soup: "Soup",
  smoothie: "Smoothie",
  nutritional_drink: "Nutritional drink",
  ice: "Ice",
  enteral_feed: "Enteral feed",
  iv_fluid: "IV fluid",
  iv_medication: "IV medication / flush",
  sports_drink: "Sports drink",
  alcohol: "Alcohol",
  broth: "Broth / stock",
  protein_shake: "Protein shake",
  other_intake: "Other intake",
  urine: "Urine",
  continence: "Continence event",
  menstrual_pad: "Menstrual pad",
  vomit: "Vomiting",
  diarrhoea: "Diarrhoea",
  stoma: "Stoma output",
  drain: "Drain output",
  nasogastric: "Nasogastric output",
  sweating: "Sweating",
  dialysis: "Dialysis fluid removed",
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
  "smoothie",
  "nutritional_drink",
  "ice",
  "enteral_feed",
  "iv_fluid",
  "iv_medication",
  "sports_drink",
  "alcohol",
  "broth",
  "protein_shake",
  "other_intake",
];

// menstrual_pad is deliberately excluded here — it's only shown to patients
// whose profile has sex === "female" (see OutputFlowPage's filtered use of
// this list, and QuickAddGrid/useStore's newQuickButtons).
export const OUTPUT_CATEGORIES: OutputCategory[] = [
  "urine",
  "continence",
  "menstrual_pad",
  "vomit",
  "diarrhoea",
  "stoma",
  "drain",
  "nasogastric",
  "sweating",
  "dialysis",
  "other_output",
];

export const INPUT_METHOD_LABEL: Record<string, string> = {
  tap: "Quick tap",
  manual: "Manual entry",
  voice: "Voice entry",
};
export const INPUT_METHOD_ICON: Record<string, Icon> = {
  tap: HandTap,
  manual: Keyboard,
  voice: Microphone,
};

export function InputMethodIcon({
  method,
  ...props
}: { method: string } & IconProps) {
  const IconComponent = INPUT_METHOD_ICON[method] ?? Keyboard;
  return <IconComponent {...props} />;
}
