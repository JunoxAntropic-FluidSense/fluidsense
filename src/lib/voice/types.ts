import type {
  Direction,
  FluidCategory,
  FluidEvent,
  MeasurementStatus,
  OutputCategory,
} from "../../types";
import type { UploadPhotoResult } from "../photo/storage";

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
  // Transient in-memory-only photo attachment state, populated via
  // PhotoCaptureField's onAttach on the Voice confirm screen (issue #0015).
  // Never persisted directly into FluidEvent — confirmAll reads
  // pendingPhotoAttach once, after addEvent() has already created and
  // returned the event, then calls updateEvent(id, { photoStoragePath }).
  pendingPhotoPreviewUrl?: string;
  pendingPhotoAttach?: (
    profileId: string,
    eventId: string
  ) => Promise<UploadPhotoResult>;
}

export interface VoiceParseResult {
  intent: VoiceIntent;
  events: StructuredVoiceEvent[];
  originalTranscript: string;
}
