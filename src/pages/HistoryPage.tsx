import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { useActivePatient } from "../hooks/useFluidData";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EventRow } from "../components/EventRow";
import { EditEventModal } from "../components/EditEventModal";
import type { FluidEvent } from "../types";

type DirectionFilter = "all" | "intake" | "output" | "unmeasured";
type StatusFilter = "all" | "measured" | "estimated";
type MethodFilter = "all" | "voice" | "manual";

const UNDO_WINDOW_MS = 8000;

export function HistoryPage() {
  const patient = useActivePatient();
  const currentUser = useStore((s) => s.currentUser);
  const events = useStore((s) => s.events);
  const deleteEvents = useStore((s) => s.deleteEvents);
  const restoreEvent = useStore((s) => s.restoreEvent);
  const [editing, setEditing] = useState<FluidEvent | null>(null);

  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [method, setMethod] = useState<MethodFilter>("all");
  const [enteredBy, setEnteredBy] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [undoBatch, setUndoBatch] = useState<string[] | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    []
  );

  const patientEvents = useMemo(
    () =>
      events
        .filter((e) => !e.deleted && e.patientId === patient?.id)
        .sort(
          (a, b) =>
            new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime()
        ),
    [events, patient]
  );

  const recorders = useMemo(
    () => Array.from(new Set(patientEvents.map((e) => e.enteredBy))),
    [patientEvents]
  );

  const filtered = useMemo(
    () =>
      patientEvents.filter((e) => {
        if (direction === "intake" && e.direction !== "intake") return false;
        if (direction === "output" && e.direction !== "output") return false;
        if (direction === "unmeasured" && e.status !== "unmeasured")
          return false;
        if (status === "measured" && e.status !== "measured") return false;
        if (
          status === "estimated" &&
          !(e.status === "container_estimated" || e.status === "approximate")
        )
          return false;
        if (method === "voice" && e.inputMethod !== "voice") return false;
        if (method === "manual" && e.inputMethod === "voice") return false;
        if (enteredBy !== "all" && e.enteredBy !== enteredBy) return false;
        if (from && new Date(e.eventTime) < new Date(from)) return false;
        if (to && new Date(e.eventTime) > new Date(to)) return false;
        return true;
      }),
    [patientEvents, direction, status, method, enteredBy, from, to]
  );

  if (!patient) return null;

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAllInFilter = () =>
    setSelected(new Set(filtered.map((e) => e.id)));
  const clearSelection = () => {
    setSelected(new Set());
    setSelectMode(false);
  };

  const confirmDeleteSelected = () => {
    const ids = Array.from(selected);
    deleteEvents(
      ids,
      currentUser.displayName,
      "Deleted from History (multi-select)"
    );
    setConfirmDelete(false);
    setUndoBatch(ids);
    setSelected(new Set());
    setSelectMode(false);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoBatch(null), UNDO_WINDOW_MS);
  };

  const undo = () => {
    undoBatch?.forEach((id) => restoreEvent(id));
    setUndoBatch(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  };

  if (patientEvents.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">History</h1>
          <p className="text-sm text-fog-600">{patient.displayName}</p>
        </div>
        <Card className="p-6 text-center">
          <p className="text-lg font-extrabold text-navy-900">
            No previous entries
          </p>
          <p className="text-sm text-fog-600 mt-1">
            Your recorded fluid events will appear here.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">History</h1>
          <p className="text-sm text-fog-600">
            {patient.displayName} · audit-style event log
          </p>
        </div>
        <Button
          size="md"
          variant="secondary"
          onClick={() => (selectMode ? clearSelection() : setSelectMode(true))}
        >
          {selectMode ? "Cancel" : "Select"}
        </Button>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <FilterSelect
            label="Direction"
            value={direction}
            onChange={(v) => setDirection(v as DirectionFilter)}
            options={[
              ["all", "All entries"],
              ["intake", "Intake"],
              ["output", "Output"],
              ["unmeasured", "Unmeasured events"],
            ]}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as StatusFilter)}
            options={[
              ["all", "All statuses"],
              ["measured", "Measured"],
              ["estimated", "Estimated"],
            ]}
          />
          <FilterSelect
            label="Input method"
            value={method}
            onChange={(v) => setMethod(v as MethodFilter)}
            options={[
              ["all", "All methods"],
              ["voice", "Voice entries"],
              ["manual", "Manual / tap entries"],
            ]}
          />
          <FilterSelect
            label="Recorded by"
            value={enteredBy}
            onChange={setEnteredBy}
            options={[
              ["all", "Everyone"],
              ...recorders.map((r) => [r, r] as [string, string]),
            ]}
          />
          <label className="text-xs font-semibold text-navy-700">
            From
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-navy-900/15 px-2 py-2 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-navy-700">
            To
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-navy-900/15 px-2 py-2 text-sm font-normal"
            />
          </label>
        </div>
      </Card>

      {selectMode && (
        <Card className="p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-navy-800">
            {selected.size} selected
          </p>
          <div className="flex gap-2">
            <Button size="md" variant="secondary" onClick={selectAllInFilter}>
              Select all ({filtered.length})
            </Button>
            <Button
              size="md"
              variant="danger"
              disabled={selected.size === 0}
              onClick={() => setConfirmDelete(true)}
            >
              Delete selected
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <p className="text-sm text-fog-500 mb-2">
          {filtered.length} entr{filtered.length === 1 ? "y" : "ies"}
        </p>
        {filtered.length === 0 ? (
          <p className="text-sm text-fog-600">
            No entries match these filters.
          </p>
        ) : (
          <ul>
            {filtered.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                onEdit={selectMode ? undefined : setEditing}
                selectable={selectMode}
                selected={selected.has(e.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </ul>
        )}
      </Card>

      {editing && (
        <EditEventModal event={editing} onClose={() => setEditing(null)} />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-40 flex items-end md:items-center md:justify-center bg-navy-950/40"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full md:max-w-md md:rounded-3xl rounded-t-3xl p-5">
            <h2 className="text-lg font-extrabold text-navy-900 mb-2">
              Delete {selected.size} entr{selected.size === 1 ? "y" : "ies"}?
            </h2>
            <p className="text-sm text-fog-600 mb-4">
              You'll have a few seconds to undo this after deleting.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDeleteSelected}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {undoBatch && (
        <div className="fixed bottom-20 md:bottom-6 inset-x-0 flex justify-center z-30 px-4">
          <div className="bg-navy-900 text-white rounded-2xl px-4 py-3 flex items-center gap-4 shadow-lg">
            <span className="text-sm">
              {undoBatch.length} entr{undoBatch.length === 1 ? "y" : "ies"}{" "}
              deleted
            </span>
            <button
              onClick={undo}
              className="text-sm font-bold underline hover:no-underline"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="text-xs font-semibold text-navy-700">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-navy-900/15 px-2 py-2 text-sm font-normal bg-white"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
