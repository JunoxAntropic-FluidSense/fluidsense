import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { endOfDay } from "date-fns";
import { useStore } from "../store/useStore";
import { useActivePatient } from "../hooks/useFluidData";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import { Field, Input, Select } from "../components/ui/Field";
import { DateRangePicker } from "../components/ui/DateRangePicker";
import { NoActivePatientState } from "../components/ui/NoActivePatientState";
import { EventRow } from "../components/EventRow";
import { EditEventModal } from "../components/EditEventModal";
import type { FluidEvent, PatientProfile } from "../types";

type DirectionFilter = "all" | "intake" | "output" | "unmeasured";
type StatusFilter = "all" | "measured" | "estimated";
type MethodFilter = "all" | "voice" | "manual";

const DIRECTION_OPTIONS: { value: DirectionFilter; label: string }[] = [
  { value: "all", label: "All entries" },
  { value: "intake", label: "Intake" },
  { value: "output", label: "Output" },
  { value: "unmeasured", label: "Unmeasured" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "measured", label: "Measured" },
  { value: "estimated", label: "Estimated" },
];

const METHOD_OPTIONS: { value: MethodFilter; label: string }[] = [
  { value: "all", label: "All methods" },
  { value: "voice", label: "Voice" },
  { value: "manual", label: "Manual / tap" },
];

const UNDO_WINDOW_MS = 8000;

export function HistoryPage() {
  const patient = useActivePatient();
  const currentUser = useStore((s) => s.currentUser);
  const mode = useStore((s) => s.mode);
  const events = useStore((s) => s.events);
  const deleteEvents = useStore((s) => s.deleteEvents);
  const restoreEvent = useStore((s) => s.restoreEvent);
  const [editing, setEditing] = useState<FluidEvent | null>(null);

  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [method, setMethod] = useState<MethodFilter>("all");
  const [enteredBy, setEnteredBy] = useState("all");
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);

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
        if (from && new Date(e.eventTime) < from) return false;
        if (to && new Date(e.eventTime) > endOfDay(to)) return false;
        return true;
      }),
    [patientEvents, direction, status, method, enteredBy, from, to]
  );

  if (!patient) return <NoActivePatientState />;

  // Home & community mode: a clinician viewing this patient's record is
  // read-only on patient/carer-entered events — they can only add a
  // ClinicalNote (below). Inpatient mode allows staff to open the edit
  // modal, but only to verify/correct/reject (see EditEventModal), never a
  // silent edit. Patient/carer accounts (mode === "patient") always retain
  // full edit access to their own entries regardless of deploymentMode.
  const clinicianReadOnly =
    mode === "healthcare" &&
    (patient.deploymentMode ?? "home_community") !== "inpatient";

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
        {mode === "healthcare" && <ClinicalNotesCard patient={patient} />}
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
        {!clinicianReadOnly && (
          <Button
            size="md"
            variant="secondary"
            onClick={() =>
              selectMode ? clearSelection() : setSelectMode(true)
            }
          >
            {selectMode ? "Cancel" : "Select"}
          </Button>
        )}
      </div>

      {clinicianReadOnly && (
        <Card className="p-4 bg-fog-50 border-navy-900/5">
          <p className="text-sm text-navy-700">
            Home &amp; community monitoring: this patient's entries are
            read-only here. Add a clinical note below instead of editing their
            record.
          </p>
        </Card>
      )}

      {mode === "healthcare" && <ClinicalNotesCard patient={patient} />}

      <Card className="p-5 space-y-4">
        <div className="space-y-3">
          <FilterGroup label="Direction">
            <SegmentedTabs
              label="Direction"
              value={direction}
              onChange={setDirection}
              options={DIRECTION_OPTIONS}
            />
          </FilterGroup>
          <FilterGroup label="Status">
            <SegmentedTabs
              label="Status"
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
            />
          </FilterGroup>
          <FilterGroup label="Input method">
            <SegmentedTabs
              label="Input method"
              value={method}
              onChange={setMethod}
              options={METHOD_OPTIONS}
            />
          </FilterGroup>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border-t border-navy-900/5 pt-4">
          <FilterSelect
            label="Recorded by"
            value={enteredBy}
            onChange={setEnteredBy}
            options={[
              ["all", "Everyone"],
              ...recorders.map((r) => [r, r] as [string, string]),
            ]}
          />
          <Field label="Date range" className="[&>span]:text-xs">
            <DateRangePicker
              from={from}
              to={to}
              onChange={(range) => {
                setFrom(range.from);
                setTo(range.to);
              }}
            />
          </Field>
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
                onEdit={
                  selectMode || clinicianReadOnly ? undefined : setEditing
                }
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

function ClinicalNotesCard({ patient }: { patient: PatientProfile }) {
  const currentUser = useStore((s) => s.currentUser);
  const clinicalNotes = useStore((s) => s.clinicalNotes);
  const addClinicalNote = useStore((s) => s.addClinicalNote);
  const [newNote, setNewNote] = useState("");
  const patientNotes = clinicalNotes.filter((n) => n.patientId === patient.id);

  return (
    <Card className="p-5 space-y-3">
      <p className="text-sm font-bold text-navy-900">Clinical notes</p>
      <p className="text-xs text-fog-500">
        Your interpretation, targets, or acknowledgement of review — kept
        separate from {patient.displayName}'s own entries, never merged with
        them.
      </p>
      <div className="flex gap-2 items-end">
        <Field label="Add a note" className="flex-1">
          <Input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="e.g. Reviewed, balance trending negative"
          />
        </Field>
        <Button
          disabled={!newNote.trim()}
          onClick={() => {
            addClinicalNote({
              patientId: patient.id,
              authorName: currentUser.displayName,
              authorRole: currentUser.role,
              kind: "note",
              text: newNote.trim(),
            });
            setNewNote("");
          }}
        >
          Add
        </Button>
      </div>
      {patientNotes.length > 0 && (
        <ul className="space-y-2 pt-2 border-t border-navy-900/10">
          {patientNotes.map((n) => (
            <li key={n.id} className="text-sm">
              <span className="text-fog-500">
                {new Date(n.time).toLocaleString()} — {n.authorName}:
              </span>{" "}
              {n.text}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-navy-700 mb-1.5">{label}</p>
      {children}
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
    <Field label={label} className="[&>span]:text-xs">
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm py-2"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
    </Field>
  );
}
