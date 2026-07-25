// Presentational/orchestration-only capture -> preview -> (optional estimate)
// widget for attaching a drink photo to a FluidEvent. Shared by the Add flow
// (#0014) and the Voice confirm screen (#0015) so the capture/preview/estimate
// UI only needs to be built once.
//
// Calls usePhotoCapture() internally (see issue #0013's Touch manifest for
// the rationale) rather than accepting the hook's return value as a prop —
// no existing component in this codebase prop-drills a capture-style hook's
// full return object, and keeping the hook call here scopes its lifecycle
// (object-URL cleanup, cancelledRef guards) to wherever the field is mounted,
// same as useVoiceCapture is scoped to VoicePage.
//
// This component never sets MeasurementStatus and never calls addEvent /
// updateEvent / uploadDrinkPhoto itself — per CLAUDE.md's "never blur
// measured and guessed" rule and this issue's "no new status-transition
// code" acceptance criterion, applying an AI-suggested amount stays the
// parent page's job via its own existing approximate-amount / container
// handlers. Two callbacks are exposed for that:
//   - onAcceptEstimate(amountMl): fired only when the user explicitly presses
//     "Use this amount" on the suggestion panel. The caller decides what
//     MeasurementStatus that implies (this component never assumes it).
//   - onAttach(photo | null): fired whenever a photo becomes ready (and with
//     null when it's removed), handing the parent a bound `attach` function
//     (hook's attach(), which itself only uploads and returns a storage path
//     — never writes to the store) plus the preview URL. The parent calls
//     `attach(profileId, eventId)` whenever it actually wants to upload
//     (e.g. once the event/profile IDs it needs exist), typically at save
//     time — this component never invokes it itself.
//
// No diagnostic-sounding copy anywhere: suggestions are always framed as
// "suggested"/"approximate", never as a conclusion about the user's fluid
// status.

import { useEffect, useId, useRef, type ChangeEvent } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { StatusBadge } from "../ui/Badge";
import { usePhotoCapture } from "../../hooks/usePhotoCapture";
import type { UploadPhotoResult } from "../../lib/photo/storage";

export interface PhotoAttachHandle {
  previewUrl: string;
  attach: (profileId: string, eventId: string) => Promise<UploadPhotoResult>;
}

export interface PhotoCaptureFieldProps {
  /**
   * Fired only when the user explicitly presses "Use this amount" on an AI
   * suggestion panel. The caller applies this to its own status/amount
   * state via its existing approximate-amount handlers — this component
   * never sets status itself.
   */
  onAcceptEstimate: (amountMl: number) => void;
  /**
   * Fired whenever a photo becomes ready for attaching (and with `null` when
   * removed/reset), handing the parent a bound attach() the parent can call
   * later once it has the profile/event IDs an upload needs. Optional —
   * omit if a page only cares about the estimate path.
   */
  onAttach?: (photo: PhotoAttachHandle | null) => void;
  /** Visible label for the capture trigger. Defaults to "Add a photo". */
  label?: string;
  className?: string;
}

export function PhotoCaptureField({
  onAcceptEstimate,
  onAttach,
  label = "Add a photo",
  className = "",
}: PhotoCaptureFieldProps) {
  const {
    status,
    previewUrl,
    errorMessage,
    estimate,
    estimateAvailable,
    capture,
    requestEstimate,
    attach,
    reset,
  } = usePhotoCapture();

  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // Hand the parent a bound attach() whenever a photo becomes ready, and
  // clear it (null) whenever the photo goes away — never call attach()
  // ourselves, per the "no new status-transition / no upload orchestration
  // here" scope of this issue.
  useEffect(() => {
    if (!onAttach) return;
    if (previewUrl) {
      onAttach({ previewUrl, attach });
    } else {
      onAttach(null);
    }
  }, [previewUrl, attach, onAttach]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      capture(file);
    }
    // Allow re-selecting the same file (e.g. after remove) by clearing the
    // input's value.
    e.target.value = "";
  };

  const handleRemove = () => {
    reset();
  };

  const handleRetake = () => {
    reset();
    inputRef.current?.click();
  };

  return (
    <div className={className}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={label}
        onChange={handleFileChange}
        className="sr-only"
      />

      {status === "idle" && (
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={() => inputRef.current?.click()}
        >
          {label}
        </Button>
      )}

      {status === "capturing" && (
        <Card className="p-4 text-center" role="status" aria-live="polite">
          <p className="text-sm font-bold text-navy-900">Reading photo…</p>
        </Card>
      )}

      {status === "error" && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
          <p className="text-sm text-amber-700" role="alert">
            {errorMessage ?? "Something went wrong with that photo."}
          </p>
          <Button size="md" variant="secondary" onClick={reset}>
            Try again
          </Button>
        </div>
      )}

      {(status === "ready" || status === "processing") && previewUrl && (
        <div className="space-y-3">
          <Card className="p-3 space-y-3">
            <img
              src={previewUrl}
              alt="Captured drink photo preview"
              className="w-full rounded-xl object-cover max-h-64"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="md"
                variant="secondary"
                onClick={handleRetake}
                disabled={status === "processing"}
              >
                Retake
              </Button>
              <Button
                type="button"
                size="md"
                variant="ghost"
                onClick={handleRemove}
                disabled={status === "processing"}
              >
                Remove
              </Button>
            </div>

            {estimateAvailable && !estimate && (
              <Button
                type="button"
                size="md"
                variant="secondary"
                fullWidth
                disabled={status === "processing"}
                onClick={() => requestEstimate()}
              >
                Estimate amount from photo
              </Button>
            )}
          </Card>

          {status === "processing" && (
            <div
              className="rounded-xl bg-amber-50 border border-amber-200 p-3"
              role="status"
              aria-live="polite"
            >
              <p className="text-sm font-bold text-amber-700">
                Estimating amount from photo…
              </p>
            </div>
          )}

          {estimate && estimate.status === "ok" && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <StatusBadge status="approximate" />
                <p className="text-sm font-bold text-amber-700">
                  Suggested amount
                </p>
              </div>
              <p className="text-sm text-amber-800">
                {estimate.estimatedMl} mL
                {estimate.containerGuess
                  ? ` (${estimate.containerGuess})`
                  : ""}{" "}
                — you decide whether to use this.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="md"
                  onClick={() => onAcceptEstimate(estimate.estimatedMl)}
                >
                  Use this amount
                </Button>
                <Button
                  type="button"
                  size="md"
                  variant="ghost"
                  onClick={() => requestEstimate()}
                >
                  Try again
                </Button>
              </div>
            </div>
          )}

          {estimate &&
            (estimate.status === "unavailable" ||
              estimate.status === "error") && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm text-amber-700" role="alert">
                  {estimate.message}
                </p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
