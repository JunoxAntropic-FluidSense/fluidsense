import { useState } from "react";
import type { FluidEvent, MeasurementStatus } from "../types";
import { useEscapeClose } from "../hooks/useEscapeClose";
import { useStore } from "../store/useStore";
import { useActivePatient } from "../hooks/useFluidData";
import { Button } from "./ui/Button";
import { Field, Input } from "./ui/Field";
import { SegmentedTabs } from "./ui/SegmentedTabs";
import { PhotoThumbnail } from "./PhotoThumbnail";
import { CATEGORY_LABEL } from "../lib/eventMeta";
import { format } from "date-fns";

const VERIFICATION_LABEL: Record<string, string> = {
  unverified: "Not yet reviewed",
  verified: "Verified",
  corrected: "Corrected",
  rejected: "Rejected — excluded from confirmed totals",
};

const STATUS_OPTIONS: { value: MeasurementStatus; label: string }[] = [
  { value: "measured", label: "Measured" },
  { value: "container_estimated", label: "Container estimate" },
  { value: "approximate", label: "Approximate" },
  { value: "unmeasured", label: "Unmeasured" },
];

export function EditEventModal({
  event,
  onClose,
}: {
  event: FluidEvent;
  onClose: () => void;
}) {
  useEscapeClose(onClose);
  const updateEvent = useStore((s) => s.updateEvent);
  const correctEvent = useStore((s) => s.correctEvent);
  const setEventVerification = useStore((s) => s.setEventVerification);
  const deleteEvent = useStore((s) => s.deleteEvent);
  const currentUser = useStore((s) => s.currentUser);
  const mode = useStore((s) => s.mode);
  const patient = useActivePatient();

  // Inpatient mode: staff editing here are verifying/correcting a
  // patient-entered record, not silently editing it — save() below routes
  // through correctEvent so that's recorded in the same editHistory audit
  // trail as everything else. Any other context (patient/carer editing their
  // own entry, or home_community mode) is a plain edit via updateEvent.
  const isInpatientReview =
    mode === "healthcare" && patient?.deploymentMode === "inpatient";

  const [amountMl, setAmountMl] = useState(
    event.amountMl != null ? String(event.amountMl) : ""
  );
  const [status, setStatus] = useState<MeasurementStatus>(event.status);
  const [note, setNote] = useState(event.note ?? "");
  const [reason, setReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    const changes = {
      amountMl:
        status === "unmeasured"
          ? undefined
          : amountMl
            ? parseFloat(amountMl)
            : undefined,
      status,
      note: note || undefined,
    };
    if (isInpatientReview) {
      correctEvent(
        event.id,
        changes,
        currentUser.displayName,
        reason || undefined
      );
    } else {
      updateEvent(
        event.id,
        changes,
        currentUser.displayName,
        reason || undefined
      );
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end md:items-center md:justify-center bg-navy-950/40"
      role="dialog"
      aria-modal="true"
      aria-label="Edit entry"
    >
      <div className="bg-white w-full md:max-w-md md:rounded-3xl rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-navy-900">
            Edit {CATEGORY_LABEL[event.category]}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="min-h-11 min-w-11 rounded-full hover:bg-fog-100 text-xl"
          >
            ×
          </button>
        </div>

        {isInpatientReview && (
          <div className="mb-4 rounded-xl bg-fog-50 p-3 text-sm">
            <span className="font-semibold text-navy-800">
              Entered by {event.enteredBy}
              {event.enteredByRole ? ` (${event.enteredByRole})` : ""}
            </span>
            <p className="text-fog-600 mt-0.5">
              {VERIFICATION_LABEL[event.verificationStatus ?? "unverified"]}
              {event.verifiedBy ? ` — by ${event.verifiedBy}` : ""}
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-navy-700 mb-1.5">
              Measurement status
            </p>
            <SegmentedTabs
              label="Measurement status"
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
            />
          </div>

          {status !== "unmeasured" && (
            <Field
              label="Volume (mL)"
              hint={`Original: ${event.amountMl != null ? `${event.amountMl} mL` : "none"}`}
            >
              <Input
                inputMode="decimal"
                value={amountMl}
                onChange={(e) => setAmountMl(e.target.value)}
              />
            </Field>
          )}

          <Field label="Note">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <Field label="Reason for change (optional)">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. corrected transcription error"
            />
          </Field>

          {event.photoStoragePath && (
            <div className="block text-sm font-semibold text-navy-700 space-y-2">
              <span>Photo</span>
              <div className="flex items-center gap-3">
                <PhotoThumbnail
                  path={event.photoStoragePath}
                  size="md"
                  alt="Attached photo for this entry"
                />
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() =>
                    updateEvent(
                      event.id,
                      { photoStoragePath: undefined },
                      currentUser.displayName,
                      reason || "Removed photo"
                    )
                  }
                >
                  Remove photo
                </Button>
              </div>
            </div>
          )}

          {event.editHistory && event.editHistory.length > 0 && (
            <div className="rounded-xl bg-fog-50 p-3 text-xs text-fog-600 space-y-1">
              <p className="font-bold text-fog-700">Edit history</p>
              {event.editHistory.map((h, i) => (
                <p key={i}>
                  {format(new Date(h.time), "d MMM HH:mm")} — {h.field}: "
                  {h.originalValue}" → "{h.updatedValue}" by {h.changedBy}
                  {h.reason ? ` (${h.reason})` : ""}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 space-y-2">
          <Button fullWidth onClick={save}>
            {isInpatientReview ? "Save correction" : "Save changes"}
          </Button>
          {isInpatientReview && (
            <div className="flex gap-2">
              <Button
                fullWidth
                variant="secondary"
                size="md"
                onClick={() => {
                  setEventVerification(
                    event.id,
                    "verified",
                    currentUser.displayName,
                    reason || undefined
                  );
                  onClose();
                }}
              >
                Verify (no changes needed)
              </Button>
              <Button
                fullWidth
                variant="danger"
                size="md"
                onClick={() => {
                  setEventVerification(
                    event.id,
                    "rejected",
                    currentUser.displayName,
                    reason || undefined
                  );
                  onClose();
                }}
              >
                Reject
              </Button>
            </div>
          )}
          {!confirmDelete ? (
            <Button
              fullWidth
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
            >
              Delete entry
            </Button>
          ) : (
            <div className="rounded-xl border border-alert-100 bg-alert-50 p-3 space-y-2">
              <p className="text-sm text-alert-600 font-semibold">
                Delete this entry? This can't be undone in the prototype.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => {
                    deleteEvent(
                      event.id,
                      currentUser.displayName,
                      reason || undefined
                    );
                    onClose();
                  }}
                >
                  Yes, delete
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
