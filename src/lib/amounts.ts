// Configurable approximate-amount presets. These are illustrative defaults,
// not universal exact volumes — users can treat them as a starting point only.
export const APPROX_INTAKE_AMOUNTS: { label: string; ml: number }[] = [
  { label: "A sip", ml: 30 },
  { label: "Small amount", ml: 100 },
  { label: "Half a cup", ml: 125 },
  { label: "One cup", ml: 250 },
  { label: "Large cup", ml: 350 },
];

export const EXACT_INTAKE_QUICK_AMOUNTS = [100, 150, 200, 250, 300, 500];

export const CONTAINER_FRACTIONS: { label: string; value: number }[] = [
  { label: "Quarter", value: 0.25 },
  { label: "Half", value: 0.5 },
  { label: "Three quarters", value: 0.75 },
  { label: "Full", value: 1 },
];

export const OUTPUT_QUICK_AMOUNTS = [100, 150, 200, 300, 400, 500];

export const CONTINENCE_SUBTYPES: { value: string; label: string }[] = [
  { value: "slightly_wet_pad", label: "Slightly wet pad" },
  { value: "moderately_wet_pad", label: "Moderately wet pad" },
  { value: "heavily_wet_pad", label: "Heavily wet pad" },
  { value: "leaking_pad", label: "Leaking pad" },
  { value: "wet_clothing", label: "Wet clothing" },
  { value: "wet_bed", label: "Wet bed" },
  { value: "unknown", label: "Amount unknown" },
];

export const MENSTRUAL_QUALITATIVE: { value: string; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "heavy", label: "Heavy" },
  { value: "unknown", label: "Amount unknown" },
];

export const UNMEASURED_URINE_SUBTYPES: { value: string; label: string }[] = [
  { value: "unmeasured_toilet", label: "Passed into toilet" },
  { value: "small_unmeasured", label: "Small amount" },
  { value: "moderate_unmeasured", label: "Moderate amount" },
  { value: "large_unmeasured", label: "Large amount" },
  { value: "unknown", label: "Amount unknown" },
];

export const VOMIT_QUALITATIVE: { value: string; label: string }[] = [
  { value: "small_unmeasured", label: "Small" },
  { value: "moderate_unmeasured", label: "Moderate" },
  { value: "large_unmeasured", label: "Large" },
  { value: "unknown", label: "Amount unknown" },
];

export const SWEATING_LEVELS: { value: string; label: string }[] = [
  { value: "none", label: "None" },
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "heavy", label: "Heavy" },
  { value: "drenched", label: "Drenched clothing or bedding" },
  { value: "unsure", label: "Unsure" },
];

export const DIARRHOEA_QUALITATIVE: { value: string; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "moderate", label: "Moderate" },
  { value: "large", label: "Large" },
  { value: "unknown", label: "Unknown" },
];
