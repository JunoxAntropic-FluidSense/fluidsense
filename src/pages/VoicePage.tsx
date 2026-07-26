import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Microphone } from "@phosphor-icons/react";
import { useVoiceCapture } from "../hooks/useVoiceCapture";
import { extractVoiceEvents } from "../lib/voice/extractEvents";
import { SERVER_STT_CONFIGURED } from "../lib/voice/transcribe";
import { speakConfirmation } from "../lib/voice/speak";
import type { StructuredVoiceEvent } from "../lib/voice/types";
import { useStore } from "../store/useStore";
import { useActivePatient } from "../hooks/useFluidData";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatusBadge } from "../components/ui/Badge";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import { Field, Input, Select } from "../components/ui/Field";
import { NoActivePatientState } from "../components/ui/NoActivePatientState";
import { PhotoCaptureField } from "../components/photo/PhotoCaptureField";
import {
  CATEGORY_LABEL,
  INTAKE_CATEGORIES,
  OUTPUT_CATEGORIES,
} from "../lib/eventMeta";
import type {
  Direction,
  MeasurementStatus,
  FluidCategory,
  OutputCategory,
} from "../types";
import { format } from "date-fns";

type Phase = "idle" | "review" | "summary_prompt" | "not_understood";
type DuplicateResolution = "keep" | "save_both" | "replace";

const DIRECTION_OPTIONS: { value: Direction; label: string }[] = [
  { value: "intake", label: "Intake" },
  { value: "output", label: "Output" },
];

const MEASUREMENT_STATUS_OPTIONS: {
  value: MeasurementStatus;
  label: string;
}[] = [
  { value: "measured", label: "Measured" },
  { value: "container_estimated", label: "Container estimate" },
  { value: "approximate", label: "Approximate" },
  { value: "unmeasured", label: "Unmeasured" },
];

export function VoicePage() {
  const navigate = useNavigate();
  const patient = useActivePatient();
  const addEvent = useStore((s) => s.addEvent);
  const updateEvent = useStore((s) => s.updateEvent);
  const deleteEvent = useStore((s) => s.deleteEvent);
  const currentUser = useStore((s) => s.currentUser);
  const fluidProfiles = useStore((s) => s.fluidProfiles);
  const events = useStore((s) => s.events);
  const capture = useVoiceCapture();

  const [phase, setPhase] = useState<Phase>("idle");
  const [candidates, setCandidates] = useState<StructuredVoiceEvent[]>([]);
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [duplicateResolutions, setDuplicateResolutions] = useState<
    Record<number, DuplicateResolution>
  >({});
  const [typedText, setTypedText] = useState("");
  const [transcriptShown, setTranscriptShown] = useState("");

  const runParse = (transcript: string) => {
    if (!patient || !transcript.trim()) return;
    setTranscriptShown(transcript);
    const result = extractVoiceEvents(transcript, {
      patient,
      fluidProfiles,
      recentEvents: events,
    });
    if (result.intent === "request_summary") {
      setPhase("summary_prompt");
      return;
    }
    if (result.events.length === 0) {
      setPhase("not_understood");
      return;
    }
    setCandidates(result.events);
    setRemoved(new Set());
    setDuplicateResolutions({});
    setPhase("review");
  };

  useEffect(() => {
    if (capture.status === "done" && capture.transcript) {
      runParse(capture.transcript);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture.status]);

  const resetAll = () => {
    setPhase("idle");
    setCandidates([]);
    setRemoved(new Set());
    setDuplicateResolutions({});
    setTypedText("");
    capture.reset();
  };

  const updateCandidate = (
    index: number,
    changes: Partial<StructuredVoiceEvent>
  ) => {
    setCandidates((cs) =>
      cs.map((c, i) => (i === index ? { ...c, ...changes } : c))
    );
  };

  const removeCandidate = (index: number) =>
    setRemoved((r) => new Set(r).add(index));

  const activeCandidates = candidates
    .map((c, i) => ({ c, i }))
    .filter(({ i }) => !removed.has(i));
  const unresolvedDuplicate = activeCandidates.some(
    ({ c, i }) => c.duplicateOf && !duplicateResolutions[i]
  );
  const allResolved = activeCandidates.every(
    ({ c }) => c.direction !== "unknown" && c.category
  );
  const canConfirm =
    activeCandidates.length > 0 && allResolved && !unresolvedDuplicate;

  const confirmAll = () => {
    if (!patient) return;
    const savedLogs: string[] = [];
    for (const { c, i } of activeCandidates) {
      if (c.direction === "unknown" || !c.category) continue;
      const resolution = duplicateResolutions[i];
      if (c.duplicateOf && resolution === "keep") continue;
      if (c.duplicateOf && resolution === "replace") {
        deleteEvent(
          c.duplicateOf.id,
          currentUser.displayName,
          "Replaced by a newer voice entry"
        );
      }
      savedLogs.push(
        c.amountMl
          ? `${Math.round(c.amountMl)} mL of ${CATEGORY_LABEL[c.category].toLowerCase()}`
          : CATEGORY_LABEL[c.category].toLowerCase()
      );
      const created = addEvent({
        patientId: patient.id,
        direction: c.direction,
        category: c.category,
        subtype: c.subtype,
        amountMl: c.amountMl,
        unit: "mL",
        status: c.measurementStatus,
        episodeCount: c.quantityOfEvents,
        containerFraction: c.containerFraction,
        eventTime: c.eventTime,
        enteredBy: currentUser.displayName,
        enteredByRole: currentUser.role,
        inputMethod: "voice",
        transcript: currentUser.saveVoiceTranscripts
          ? c.originalTranscript
          : undefined,
      });

      // Photo attachment is best-effort and happens only after the event is
      // already saved — an upload failure must never block the save itself
      // (hard rule 4: confirmation already happened via the button tap).
      if (c.pendingPhotoAttach) {
        c.pendingPhotoAttach(patient.id, created.id)
          .then((result) => {
            if (result.path && !result.error) {
              updateEvent(
                created.id,
                { photoStoragePath: result.path },
                currentUser.displayName,
                "Photo attached via voice entry"
              );
            }
          })
          .catch(() => {
            // Swallow — photo attach is best-effort and must not surface as
            // a save failure for an already-confirmed event.
          });
      }
    }
    if (savedLogs.length > 0) {
      void speakConfirmation(`Logged ${savedLogs.join(", and ")}.`);
    }
    resetAll();
    navigate("/");
  };

  if (!patient) return <NoActivePatientState />;

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Voice entry</h1>
        <p className="text-sm text-fog-600">
          Nothing is saved until you confirm it.
        </p>
      </div>

      {phase === "idle" && (
        <>
          {capture.status === "idle" && (
            <Card className="p-5 flex flex-col items-center text-center gap-4">
              <button
                onClick={capture.start}
                disabled={!capture.supported}
                aria-label="Speak an entry"
                className="w-28 h-28 rounded-full bg-intake-600 text-white flex items-center justify-center shadow-lg hover:bg-intake-700 disabled:opacity-40"
              >
                <Microphone size={40} weight="fill" aria-hidden="true" />
              </button>
              <p className="font-bold text-navy-900">Speak an entry</p>
              {!capture.supported && (
                <p className="text-sm text-amber-700">
                  Microphone recording isn't available in this browser — use the
                  text box below instead.
                </p>
              )}
              <p className="text-xs text-fog-500">
                Audio is used only to create a transcript
                {SERVER_STT_CONFIGURED ? "" : " in your browser"} and is never
                permanently stored.
                {currentUser.saveVoiceTranscripts
                  ? " The transcript is kept with the entry for your records."
                  : " The transcript itself is not saved (change this in Profile)."}
              </p>
            </Card>
          )}

          {capture.status === "requesting_permission" && (
            <Card className="p-5 text-center">
              <p className="font-bold text-navy-900">
                Requesting microphone access…
              </p>
            </Card>
          )}

          {capture.status === "listening" && (
            <Card
              className="p-5 flex flex-col items-center text-center gap-4"
              role="status"
              aria-live="polite"
            >
              <div className="w-28 h-28 rounded-full bg-intake-100 flex items-center justify-center relative">
                <span
                  className="absolute inset-0 rounded-full bg-intake-300/50 animate-ping"
                  aria-hidden="true"
                />
                <Microphone
                  size={40}
                  weight="fill"
                  className="relative text-intake-700"
                />
              </div>
              <p className="font-bold text-navy-900">Listening…</p>
              <p className="text-sm text-fog-600 tabular-nums">
                {formatElapsed(capture.elapsedSeconds)} /{" "}
                {formatElapsed(capture.maxSeconds)}
              </p>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={capture.cancel}>
                  Cancel
                </Button>
                <Button onClick={capture.stop}>Stop</Button>
              </div>
            </Card>
          )}

          {capture.status === "transcribing" && (
            <Card
              className="p-5 text-center space-y-2"
              role="status"
              aria-live="polite"
            >
              <p className="font-bold text-navy-900">Transcribing…</p>
              <p className="text-sm text-fog-600">This only takes a moment.</p>
            </Card>
          )}

          {capture.status === "error" && capture.errorMessage && (
            <Card className="p-5 bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800" role="alert">
                {capture.errorMessage}
              </p>
              <Button
                size="md"
                variant="secondary"
                className="mt-3"
                onClick={capture.reset}
              >
                Try again
              </Button>
            </Card>
          )}

          <Card className="p-5">
            <label
              className="block text-sm font-bold text-navy-800 mb-2"
              htmlFor="voice-text-fallback"
            >
              Type an entry in your own words
            </label>
            <textarea
              id="voice-text-fallback"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              rows={3}
              placeholder='e.g. "I finished my 500 mL bottle of water"'
              className="w-full rounded-xl border border-navy-900/15 px-3 py-2.5"
            />
            <Button
              fullWidth
              className="mt-3"
              disabled={!typedText.trim()}
              onClick={() => runParse(typedText)}
            >
              Process entry
            </Button>
          </Card>

          <ExampleList />
        </>
      )}

      {phase === "not_understood" && (
        <Card className="p-6 text-center space-y-4">
          <p className="font-bold text-navy-900">
            We couldn't understand that.
          </p>
          <p className="text-sm text-fog-600">
            Please try again, or type your entry instead.
          </p>
          <Button fullWidth onClick={resetAll}>
            Try again
          </Button>
        </Card>
      )}

      {phase === "summary_prompt" && (
        <Card className="p-6 text-center space-y-4">
          <p className="font-bold text-navy-900">
            That sounded like a request for a summary.
          </p>
          <Button fullWidth onClick={() => navigate("/summary")}>
            Go to summary
          </Button>
          <Button fullWidth variant="ghost" onClick={resetAll}>
            Cancel
          </Button>
        </Card>
      )}

      {phase === "review" && (
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-fog-500 mb-1">
              We heard
            </p>
            <p className="text-navy-900 italic">"{transcriptShown}"</p>
          </Card>

          {candidates.map((c, i) =>
            removed.has(i) ? null : (
              <EventCandidateCard
                key={i}
                candidate={c}
                editing={editingIndex === i}
                onToggleEdit={() =>
                  setEditingIndex(editingIndex === i ? null : i)
                }
                onChange={(changes) => updateCandidate(i, changes)}
                onRemove={() => removeCandidate(i)}
                duplicateResolution={duplicateResolutions[i]}
                onResolveDuplicate={(r) =>
                  setDuplicateResolutions((d) => ({ ...d, [i]: r }))
                }
              />
            )
          )}

          {activeCandidates.length === 0 && (
            <Card className="p-5 text-center text-sm text-fog-600">
              All entries removed — nothing left to save.
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={capture.start}>
              Record again
            </Button>
            <Button variant="ghost" onClick={resetAll}>
              Cancel all
            </Button>
          </div>
          <Button
            fullWidth
            size="xl"
            disabled={!canConfirm}
            onClick={confirmAll}
          >
            Confirm and save{" "}
            {activeCandidates.length > 1
              ? `all ${activeCandidates.length}`
              : ""}
          </Button>
        </div>
      )}
    </div>
  );
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function EventCandidateCard({
  candidate,
  editing,
  onToggleEdit,
  onChange,
  onRemove,
  duplicateResolution,
  onResolveDuplicate,
}: {
  candidate: StructuredVoiceEvent;
  editing: boolean;
  onToggleEdit: () => void;
  onChange: (changes: Partial<StructuredVoiceEvent>) => void;
  onRemove: () => void;
  duplicateResolution?: DuplicateResolution;
  onResolveDuplicate: (r: DuplicateResolution) => void;
}) {
  const isAmbiguousDirection = candidate.direction === "unknown";

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-fog-500 italic">"{candidate.clauseText}"</p>
        <button
          onClick={onRemove}
          className="text-xs font-semibold text-alert-600 shrink-0 min-h-8"
        >
          Remove
        </button>
      </div>

      {isAmbiguousDirection ? (
        <div className="space-y-2">
          <p className="text-sm font-bold text-navy-900">
            Was this intake or output?
          </p>
          <p className="text-xs text-fog-600">
            This lacks sufficient context to tell automatically.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Button size="md" onClick={() => onChange({ direction: "intake" })}>
              Intake
            </Button>
            <Button
              size="md"
              variant="output"
              onClick={() => onChange({ direction: "output" })}
            >
              Output
            </Button>
            <Button size="md" variant="ghost" onClick={onRemove}>
              Neither
            </Button>
          </div>
        </div>
      ) : !editing ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-navy-900">
              {candidate.category
                ? CATEGORY_LABEL[candidate.category]
                : "Unclear type"}{" "}
              ({candidate.direction})
            </span>
            <StatusBadge status={candidate.measurementStatus} />
          </div>
          <p className="text-2xl font-extrabold text-navy-900">
            {candidate.amountMl != null
              ? `${Math.round(candidate.amountMl)} mL`
              : "No volume"}
          </p>
          {candidate.quantityOfEvents && (
            <p className="text-sm text-fog-600">
              {candidate.quantityOfEvents} episode(s)
            </p>
          )}
          {candidate.containerName && (
            <p className="text-sm text-fog-600">
              Container: {candidate.containerName}
            </p>
          )}
          <p className="text-sm text-fog-600">Time: now</p>
          <Button size="md" variant="secondary" onClick={onToggleEdit}>
            Edit
          </Button>
        </>
      ) : (
        <EditCandidate
          candidate={candidate}
          onChange={onChange}
          onDone={onToggleEdit}
        />
      )}

      {!isAmbiguousDirection && candidate.direction === "intake" && (
        <PhotoCaptureField
          label="Add a photo of the drink"
          onAcceptEstimate={(amountMl) =>
            onChange({ amountMl, measurementStatus: "approximate" })
          }
          onAttach={(photo) =>
            onChange({
              pendingPhotoPreviewUrl: photo?.previewUrl,
              pendingPhotoAttach: photo?.attach,
            })
          }
        />
      )}

      {candidate.containerCandidates &&
        candidate.containerCandidates.length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm font-bold text-amber-700 mb-2">
              Which container?
            </p>
            <div className="flex flex-wrap gap-2">
              {candidate.containerCandidates.map((name) => (
                <button
                  key={name}
                  onClick={() =>
                    onChange({
                      containerName: name,
                      containerCandidates: undefined,
                    })
                  }
                  className="rounded-full bg-white border border-amber-300 px-3 py-1.5 text-sm font-semibold text-amber-800"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

      {candidate.ambiguities.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1">
          {candidate.ambiguities.map((a, i) => (
            <p key={i} className="text-sm text-amber-700">
              {a}
            </p>
          ))}
        </div>
      )}
      {candidate.warnings.filter(
        (w) =>
          !candidate.duplicateOf || !w.includes("already have been recorded")
      ).length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1">
          <p className="text-sm font-bold text-amber-700">
            Please check this entry
          </p>
          {candidate.warnings
            .filter(
              (w) =>
                !candidate.duplicateOf ||
                !w.includes("already have been recorded")
            )
            .map((w, i) => (
              <p key={i} className="text-sm text-amber-700">
                {w}
              </p>
            ))}
        </div>
      )}

      {candidate.duplicateOf && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
          <p className="text-sm font-bold text-amber-700">
            This may already have been recorded
          </p>
          <p className="text-xs text-amber-700">
            Existing entry: {CATEGORY_LABEL[candidate.duplicateOf.category]},{" "}
            {candidate.duplicateOf.amountMl} mL at{" "}
            {format(new Date(candidate.duplicateOf.eventTime), "HH:mm")}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onResolveDuplicate("keep")}
              className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${duplicateResolution === "keep" ? "bg-amber-600 text-white border-amber-600" : "bg-white border-amber-300 text-amber-800"}`}
            >
              Keep existing
            </button>
            <button
              onClick={() => onResolveDuplicate("save_both")}
              className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${duplicateResolution === "save_both" ? "bg-amber-600 text-white border-amber-600" : "bg-white border-amber-300 text-amber-800"}`}
            >
              Save both
            </button>
            <button
              onClick={() => onResolveDuplicate("replace")}
              className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${duplicateResolution === "replace" ? "bg-amber-600 text-white border-amber-600" : "bg-white border-amber-300 text-amber-800"}`}
            >
              Replace existing
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function EditCandidate({
  candidate,
  onChange,
  onDone,
}: {
  candidate: StructuredVoiceEvent;
  onChange: (c: Partial<StructuredVoiceEvent>) => void;
  onDone: () => void;
}) {
  const categories =
    candidate.direction === "output" ? OUTPUT_CATEGORIES : INTAKE_CATEGORIES;
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-navy-700 mb-1.5">Direction</p>
        <SegmentedTabs
          label="Direction"
          value={
            candidate.direction === "unknown" ? "intake" : candidate.direction
          }
          onChange={(direction: Direction) => onChange({ direction })}
          options={DIRECTION_OPTIONS}
        />
      </div>
      <Field label="Type">
        <Select
          value={candidate.category ?? ""}
          onChange={(e) =>
            onChange({
              category: e.target.value as FluidCategory | OutputCategory,
            })
          }
        >
          <option value="">Select…</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABEL[cat]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Volume (mL) — leave blank if unmeasured">
        <Input
          inputMode="decimal"
          value={candidate.amountMl ?? ""}
          onChange={(e) =>
            onChange({
              amountMl: e.target.value ? parseFloat(e.target.value) : undefined,
            })
          }
        />
      </Field>
      <div>
        <p className="text-sm font-semibold text-navy-700 mb-1.5">Status</p>
        <SegmentedTabs
          label="Measurement status"
          value={candidate.measurementStatus}
          onChange={(measurementStatus: MeasurementStatus) =>
            onChange({ measurementStatus })
          }
          options={MEASUREMENT_STATUS_OPTIONS}
        />
      </div>
      <Button size="md" onClick={onDone}>
        Done editing
      </Button>
    </div>
  );
}

function ExampleList() {
  const examples = [
    "I just drank half a cup of coffee.",
    "I finished my 500 mL bottle of water.",
    "The patient passed 450 mL of urine.",
    "I went to the toilet but did not measure the urine.",
    "I drank 200 mL water and passed 350 mL urine.",
    "Summarise my fluid balance for the last 24 hours.",
  ];
  return (
    <Card className="p-5">
      <p className="text-sm font-bold text-navy-800 mb-2">
        Try saying something like…
      </p>
      <ul className="text-sm text-fog-600 space-y-1.5 list-disc list-inside">
        {examples.map((e) => (
          <li key={e}>"{e}"</li>
        ))}
      </ul>
    </Card>
  );
}
