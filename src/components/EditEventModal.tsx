import { useState } from "react";
import type { FluidEvent, MeasurementStatus } from "../types";
import { useEscapeClose } from "../hooks/useEscapeClose";
import { useStore } from "../store/useStore";
import { Button } from "./ui/Button";
import { CATEGORY_LABEL } from "../lib/eventMeta";
import { format } from "date-fns";

const STATUS_OPTIONS: MeasurementStatus[] = [
  "measured",
  "container_estimated",
  "approximate",
  "unmeasured",
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
  const deleteEvent = useStore((s) => s.deleteEvent);
  const currentUser = useStore((s) => s.currentUser);

  const [amountMl, setAmountMl] = useState(
    event.amountMl != null ? String(event.amountMl) : ""
  );
  const [status, setStatus] = useState<MeasurementStatus>(event.status);
  const [note, setNote] = useState(event.note ?? "");
  const [reason, setReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    updateEvent(
      event.id,
      {
        amountMl:
          status === "unmeasured"
            ? undefined
            : amountMl
              ? parseFloat(amountMl)
              : undefined,
        status,
        note: note || undefined,
      },
      currentUser.displayName,
      reason || undefined
    );
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

        <div className="space-y-4">
          <label className="block text-sm font-semibold text-navy-700">
            Measurement status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MeasurementStatus)}
              className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>

          {status !== "unmeasured" && (
            <label className="block text-sm font-semibold text-navy-700">
              Volume (mL) — original:{" "}
              {event.amountMl != null ? `${event.amountMl} mL` : "none"}
              <input
                inputMode="decimal"
                value={amountMl}
                onChange={(e) => setAmountMl(e.target.value)}
                className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
              />
            </label>
          )}

          <label className="block text-sm font-semibold text-navy-700">
            Note
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
            />
          </label>

          <label className="block text-sm font-semibold text-navy-700">
            Reason for change (optional)
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. corrected transcription error"
              className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
            />
          </label>

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
            Save changes
          </Button>
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
