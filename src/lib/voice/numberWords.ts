// Spoken-number normalisation: converts number words (including informal
// "two fifty" style readings, decimals, and "hundred/thousand" groupings)
// into numeric values. Operates on short, already-isolated number phrases —
// callers are responsible for finding candidate spans in a larger sentence.

const UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};
const TEENS: Record<string, number> = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const ALL_SMALL: Record<string, number> = {
  ...UNITS,
  ...TEENS,
  ...TENS,
  couple: 2,
  few: 3,
  several: 3,
};
const NOOP_TOKENS = new Set(["and", "of", "a", "an"]);

function tokenize(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);
}

function accumulate(tokens: string[]): number | null {
  let total = 0;
  let current = 0;
  let matched = false;
  for (const t of tokens) {
    if (NOOP_TOKENS.has(t)) continue;
    if (t in ALL_SMALL) {
      current += ALL_SMALL[t];
      matched = true;
    } else if (t === "hundred") {
      current = (current || 1) * 100;
      matched = true;
    } else if (t === "thousand") {
      total += (current || 1) * 1000;
      current = 0;
      matched = true;
    } else {
      return null; // unrecognised token — bail rather than guess
    }
  }
  if (!matched) return null;
  return total + current;
}

// Informal reading: "two fifty" -> 250, "three fifty" -> 350, "seven twenty" -> 720.
// Distinguished from a plain two-digit number ("twenty two" = 22) by word order:
// a single-digit unit word followed by a tens/teens word.
function collapseHundredPair(tokens: string[]): number | null {
  const filtered = tokens.filter((t) => !NOOP_TOKENS.has(t));
  if (filtered.length !== 2) return null;
  const [a, b] = filtered;
  if (a in UNITS && UNITS[a] >= 1 && (b in TENS || b in TEENS)) {
    return UNITS[a] * 100 + ALL_SMALL[b];
  }
  return null;
}

/** Converts an isolated spoken-number phrase (e.g. "two fifty", "twelve hundred",
 * "one point five", "a hundred") into a number. Returns null if unrecognised. */
export function wordsToNumber(phrase: string): number | null {
  const tokens = tokenize(phrase);
  if (tokens.length === 0) return null;

  const pointIdx = tokens.indexOf("point");
  if (pointIdx !== -1) {
    const wholeTokens = tokens.slice(0, pointIdx);
    const fracTokens = tokens.slice(pointIdx + 1);
    const whole = wholeTokens.length ? (accumulate(wholeTokens) ?? 0) : 0;
    const fracDigits = fracTokens
      .filter((t) => t in UNITS)
      .map((t) => UNITS[t]);
    if (fracDigits.length === 0) return null;
    return parseFloat(`${whole}.${fracDigits.join("")}`);
  }

  const collapsed = collapseHundredPair(tokens);
  if (collapsed !== null) return collapsed;

  return accumulate(tokens);
}

// Matches a run of number-word tokens (for scanning free text). Deliberately
// conservative — "of" and "a"/"an" are only swept up adjacent to a number word.
const NUMBER_WORD = Object.keys({
  ...ALL_SMALL,
  hundred: 0,
  thousand: 0,
  point: 0,
}).join("|");
export const NUMBER_PHRASE_RE = new RegExp(
  `\\b(?:(?:a|an)\\s+)?(?:${NUMBER_WORD})(?:[\\s-]+(?:and|of|a|an|${NUMBER_WORD}))*\\b`,
  "gi"
);

/** Pre-normalises digit numerals already in the text (e.g. "250") — passthrough,
 * used so callers can run one extraction pass over mixed digit/word input. */
export function normaliseSpokenNumbers(text: string): string {
  return text.replace(NUMBER_PHRASE_RE, (match) => {
    const value = wordsToNumber(match);
    return value !== null ? String(value) : match;
  });
}

const HEDGE_WORDS =
  /\b(about|around|approximately|roughly|ish|a couple of|a few|several)\b/i;
export function isHedgedQuantity(text: string): boolean {
  return HEDGE_WORDS.test(text);
}
