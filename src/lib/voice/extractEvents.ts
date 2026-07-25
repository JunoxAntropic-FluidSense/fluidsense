import type {
  PatientProfile,
  FluidProfile,
  FluidEvent,
  MeasurementStatus,
} from "../../types";
import { classifyDirection } from "./classify";
import { detectIntakeCategory, detectOutputCategory } from "./categorize";
import { extractAmount } from "./extractAmount";
import { wordsToNumber } from "./numberWords";
import { checkPlausibility, findDuplicate } from "./plausibility";
import type {
  StructuredVoiceEvent,
  VoiceIntent,
  VoiceParseResult,
} from "./types";

const SUMMARY_RE =
  /\b(summari[sz]e|summary|fluid balance|how much (did i drink|have i drunk)|urine output.*recorded|show unmeasured|healthcare team summary)\b/i;

// Splits on commas and top-level "and", but not "and a half" (a fraction
// phrase, not a clause boundary) or "and" inside a compound number like
// "one hundred and fifty" (only suppressed when "and" directly follows
// "hundred"/"thousand" — not merely because the next clause starts with a
// number word, e.g. "tea and two watery stools" must still split).
const CLAUSE_SPLIT_RE =
  /,\s*|(?<!hundred)(?<!thousand)\s+and\s+(?!a\s+half\b)/i;

const EPISODE_RE =
  /\b(\d+|one|two|three|four|five|six)\s*(episodes?|times|watery stools?|loose stools?|stools?)\b/i;
const TWICE_RE = /\btwice\b/i;

const UNMEASURED_HINT =
  /\b(toilet|did not measure|didn't measure|not measured|unknown amount|no idea|unmeasured|couldn't measure|without measuring)\b/i;

function splitClauses(transcript: string): string[] {
  return transcript
    .split(CLAUSE_SPLIT_RE)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

function resolveContainer(
  nameHint: string | undefined,
  fraction: number | undefined,
  patient: PatientProfile,
  fluidProfiles: FluidProfile[]
) {
  if (!nameHint)
    return {
      amountMl: undefined as number | undefined,
      resolvedName: undefined as string | undefined,
      candidates: [] as string[],
    };
  const needle = nameHint.toLowerCase();
  const matches = patient.containers.filter(
    (c) =>
      c.name.toLowerCase().includes(needle) ||
      needle.includes(c.name.toLowerCase().split(" ")[0])
  );
  if (matches.length === 1) {
    return {
      amountMl:
        fraction != null
          ? Math.round(matches[0].fullVolumeMl * fraction)
          : undefined,
      resolvedName: matches[0].name,
      candidates: [],
    };
  }
  if (matches.length > 1) {
    return {
      amountMl: undefined,
      resolvedName: undefined,
      candidates: matches.map((m) => m.name),
    };
  }
  // fall back to a favourite fluid profile whose name/category mentions the hint
  const favProfiles = fluidProfiles.filter(
    (fp) =>
      patient.favouriteFluidIds.includes(fp.id) &&
      fp.name.toLowerCase().includes(needle)
  );
  if (favProfiles.length === 1 && favProfiles[0].containerVolumeMl != null) {
    return {
      amountMl:
        fraction != null
          ? Math.round(favProfiles[0].containerVolumeMl * fraction)
          : undefined,
      resolvedName: favProfiles[0].name,
      candidates: [],
    };
  }
  return { amountMl: undefined, resolvedName: undefined, candidates: [] };
}

interface ExtractOptions {
  patient: PatientProfile;
  fluidProfiles: FluidProfile[];
  recentEvents: FluidEvent[];
  now?: Date;
}

export function extractVoiceEvents(
  transcript: string,
  opts: ExtractOptions
): VoiceParseResult {
  const now = opts.now ?? new Date();
  const trimmed = transcript.trim();

  if (SUMMARY_RE.test(trimmed)) {
    return {
      intent: "request_summary",
      events: [],
      originalTranscript: trimmed,
    };
  }

  const clauses = splitClauses(trimmed);
  const events: StructuredVoiceEvent[] = clauses.map((clause) =>
    buildEvent(clause, trimmed, now, opts)
  );

  const intent: VoiceIntent = events.length > 0 ? "add_event" : "unknown";
  return { intent, events, originalTranscript: trimmed };
}

function buildEvent(
  clause: string,
  originalTranscript: string,
  now: Date,
  opts: ExtractOptions
): StructuredVoiceEvent {
  const { patient, fluidProfiles, recentEvents } = opts;
  const ambiguities: string[] = [];
  const lower = clause.toLowerCase();

  const classification = classifyDirection(clause);
  let direction = classification.direction;

  let category =
    direction === "intake"
      ? (detectIntakeCategory(clause) ?? "water")
      : direction === "output"
        ? (detectOutputCategory(clause) ?? "urine")
        : (detectIntakeCategory(clause) ??
          detectOutputCategory(clause) ??
          undefined);

  // A category match with no direction verb is still enough context to resolve direction.
  if (direction === "unknown" && category) {
    direction = detectIntakeCategory(clause) ? "intake" : "output";
  }

  const amount = extractAmount(clause);
  let amountMl = amount?.amountMl;
  let status: MeasurementStatus = amount?.status ?? "unmeasured";
  let containerName: string | undefined;
  let containerCandidates: string[] | undefined;

  if (amount?.containerNameHint && amountMl === undefined) {
    const resolved = resolveContainer(
      amount.containerNameHint,
      amount.containerFraction,
      patient,
      fluidProfiles
    );
    if (resolved.amountMl !== undefined) {
      amountMl = resolved.amountMl;
      containerName = resolved.resolvedName;
    } else if (resolved.candidates.length > 1) {
      containerCandidates = resolved.candidates;
      ambiguities.push(
        `More than one saved container matches "${amount.containerNameHint}" — please choose which one.`
      );
    } else {
      ambiguities.push(
        `No saved container found for "${amount.containerNameHint}" — please enter the amount.`
      );
    }
  }

  if (amount?.ambiguityNote) ambiguities.push(amount.ambiguityNote);

  if (UNMEASURED_HINT.test(lower)) {
    status = "unmeasured";
    amountMl = undefined;
  }

  if (direction === "unknown") {
    ambiguities.push(
      "This lacks sufficient context. Was this intake or output?"
    );
  } else if (!category) {
    ambiguities.push(
      direction === "intake"
        ? "Unclear fluid type — please confirm what was consumed."
        : "Unclear output type — please confirm."
    );
  }

  // episode counts (diarrhoea, vomiting)
  let episodeCount: number | undefined;
  const episodeMatch = lower.match(EPISODE_RE);
  if (episodeMatch) {
    const raw = episodeMatch[1];
    episodeCount = /^\d+$/.test(raw)
      ? parseInt(raw, 10)
      : (wordsToNumber(raw) ?? undefined);
  } else if (TWICE_RE.test(lower)) {
    episodeCount = 2;
  }

  const warnings = category
    ? checkPlausibility({
        direction: direction === "unknown" ? "intake" : direction,
        category,
        amountMl,
      })
    : [];

  let duplicateOf: FluidEvent | undefined;
  if (amountMl !== undefined && category && direction !== "unknown") {
    duplicateOf = findDuplicate(
      { patientId: patient.id, direction, category, amountMl },
      recentEvents,
      now
    );
    if (duplicateOf)
      warnings.push(
        "This may already have been recorded — a very similar entry was saved a few minutes ago."
      );
  }

  const confidence =
    direction === "unknown"
      ? 0.2
      : Math.min(
          1,
          classification.confidence *
            (amountMl !== undefined || status === "unmeasured" ? 1 : 0.7)
        );

  return {
    intent: "add_event",
    direction,
    category,
    amountValue: amount?.rawValue,
    amountUnit: amount?.rawUnit ?? undefined,
    amountMl,
    measurementStatus: status,
    quantityOfEvents: episodeCount,
    containerName,
    containerCandidates,
    containerFraction: amount?.containerFraction,
    eventTime: now.toISOString(),
    confidence,
    ambiguities,
    warnings,
    duplicateOf,
    originalTranscript,
    clauseText: clause,
  };
}
