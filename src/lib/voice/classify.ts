import type { Direction } from "../../types";

export interface ClassificationResult {
  direction: Direction | "unknown";
  confidence: number;
  matchedIntake: string[];
  matchedOutput: string[];
}

// Deterministic clinical-keyword rules — verbs/phrases first (stronger signal
// than a bare substance noun), then common substances/contexts.
const INTAKE_PATTERNS: [RegExp, number][] = [
  [/\bdrank\b/, 1],
  [/\bdrinking\b/, 1],
  [/\bdrink\b/, 0.8],
  [/\bhaving\b/, 0.6],
  [/\bhad a cup\b/, 1],
  [/\bfinished\b/, 0.8],
  [/\bsipped\b/, 1],
  [/\bconsumed\b/, 1],
  [/\bate soup\b/, 1],
  [/\btook orally\b/, 1],
  [/\boral fluid\b/, 1],
  [/\biv fluid (started|completed|given)\b/, 1],
  [/\bfeed given\b/, 1],
  [/\bflush given\b/, 1],
  [/\bwater\b/, 0.5],
  [/\btea\b/, 0.5],
  [/\bcoffee\b/, 0.5],
  [/\bjuice\b/, 0.5],
  [/\bsquash\b/, 0.5],
  [/\bmilk\b/, 0.5],
  [/\bsoup\b/, 0.5],
  [/\bnutritional drink\b/, 0.6],
  [/\bshake\b/, 0.4],
  [/\bmug\b/, 0.4],
  [/\bglass\b/, 0.4],
  [/\bbottle\b/, 0.4],
  [/\bice chips?\b/, 0.5],
  [/\bice\b/, 0.3],
  [/\benteral feed\b/, 0.8],
  [/\biv fluid\b/, 0.7],
  [/\bsaline\b/, 0.6],
  [/\bdextrose\b/, 0.6],
  [/\bflush\b/, 0.5],
];

const OUTPUT_PATTERNS: [RegExp, number][] = [
  [/\bpassed urine\b/, 1],
  [/\bpassed water\b/, 1],
  [/\bpee(d|ing)?\b/, 1],
  [/\burinated\b/, 1],
  [/\bopened (my |his |her |their )?bladder\b/, 1],
  [/\burine output\b/, 1],
  [/\bemptied (the |my )?urine bottle\b/, 1],
  [/\bcatheter (bag )?drained\b/, 1],
  [/\bbag drained\b/, 1],
  [/\bvomit(ed|ing)?\b/, 1],
  [/\bwas sick\b/, 1],
  [/\bthrew up\b/, 1],
  [/\bdiarrhoea\b/, 1],
  [/\bdiarrhea\b/, 1],
  [/\bwatery stools?\b/, 1],
  [/\bloose stools?\b/, 1],
  [/\bstoma output\b/, 1],
  [/\bdrain output\b/, 1],
  [/\bng output\b/, 1],
  [/\bnasogastric\b/, 0.8],
  [/\bwet pad\b/, 1],
  [/\bwet bed\b/, 1],
  [/\bincontinent\b/, 1],
  [/\bsweat(ing)?\b/, 0.8],
  [/\btoilet\b/, 0.4],
  [/\burine\b/, 0.6],
  [/\bstool\b/, 0.6],
];

export function classifyDirection(clause: string): ClassificationResult {
  const text = clause.toLowerCase();
  const matchedIntake: string[] = [];
  const matchedOutput: string[] = [];
  let intakeScore = 0;
  let outputScore = 0;

  for (const [re, weight] of INTAKE_PATTERNS) {
    if (re.test(text)) {
      matchedIntake.push(re.source);
      intakeScore += weight;
    }
  }
  for (const [re, weight] of OUTPUT_PATTERNS) {
    if (re.test(text)) {
      matchedOutput.push(re.source);
      outputScore += weight;
    }
  }

  if (intakeScore === 0 && outputScore === 0) {
    return {
      direction: "unknown",
      confidence: 0,
      matchedIntake,
      matchedOutput,
    };
  }
  if (outputScore > intakeScore * 1.2) {
    return {
      direction: "output",
      confidence: Math.min(1, 0.4 + outputScore / 3),
      matchedIntake,
      matchedOutput,
    };
  }
  if (intakeScore > outputScore * 1.2) {
    return {
      direction: "intake",
      confidence: Math.min(1, 0.4 + intakeScore / 3),
      matchedIntake,
      matchedOutput,
    };
  }
  // Genuinely close/tied — don't guess.
  return { direction: "unknown", confidence: 0, matchedIntake, matchedOutput };
}
