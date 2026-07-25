import type {
  Direction,
  FluidCategory,
  FluidEvent,
  MeasurementStatus,
  OutputCategory,
} from "../../types";

export type VoiceIntent =
  "add_event" | "request_summary" | "edit_event" | "unknown";

export interface StructuredVoiceEvent {
  intent: VoiceIntent;
  direction: Direction | "unknown";
  category?: FluidCategory | OutputCategory;
  subtype?: string;
  amountValue?: number;
  amountUnit?: string;
  amountMl?: number;
  measurementStatus: MeasurementStatus;
  quantityOfEvents?: number;
  containerName?: string;
  containerCandidates?: string[]; // populated when more than one saved container matches — never guessed silently
  containerFraction?: number;
  eventTime: string;
  confidence: number;
  ambiguities: string[];
  warnings: string[];
  duplicateOf?: FluidEvent;
  originalTranscript: string;
  clauseText: string;
}

export interface VoiceParseResult {
  intent: VoiceIntent;
  events: StructuredVoiceEvent[];
  originalTranscript: string;
}
