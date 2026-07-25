import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useStore } from "../store/useStore";
import { useActivePatient } from "../hooks/useFluidData";
import { Card, CardHeading } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import { Field, Input } from "../components/ui/Field";
import { NoActivePatientState } from "../components/ui/NoActivePatientState";
import { DIALYSIS_MODALITY_LABEL } from "../types";
import type { DialysisModality } from "../types";

export function CareLogPage() {
  const patient = useActivePatient();
  const currentUser = useStore((s) => s.currentUser);
  const medicationEvents = useStore((s) => s.medicationEvents);
  const dialysisAppointments = useStore((s) => s.dialysisAppointments);
  const addMedicationEvent = useStore((s) => s.addMedicationEvent);
  const addDialysisAppointment = useStore((s) => s.addDialysisAppointment);

  const [showMedForm, setShowMedForm] = useState(false);
  const [showDialysisForm, setShowDialysisForm] = useState(false);

  if (!patient) return <NoActivePatientState />;

  const patientMeds = medicationEvents
    .filter((m) => m.patientId === patient.id)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const patientDialysis = dialysisAppointments
    .filter((d) => d.patientId === patient.id)
    .sort(
      (a, b) =>
        new Date(b.scheduledTime).getTime() -
        new Date(a.scheduledTime).getTime()
    );

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">
          Medications &amp; dialysis
        </h1>
        <p className="text-sm text-fog-600">
          A record of what was reported — not used to calculate or suggest
          changes to medication or treatment.
        </p>
      </div>

      <Card className="p-5">
        <CardHeading>Medications</CardHeading>
        {patientMeds.length === 0 ? (
          <p className="text-sm text-fog-600">No medications recorded yet.</p>
        ) : (
          <ul className="space-y-3 mb-3">
            {patientMeds.map((m) => (
              <li
                key={m.id}
                className="rounded-2xl border border-navy-900/10 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-navy-900">{m.name}</span>
                  <span className="text-xs text-fog-500">
                    {format(new Date(m.time), "d MMM, HH:mm")}
                  </span>
                </div>
                <p className="text-sm text-fog-600">
                  {m.dose} · {m.frequency}
                </p>
                {m.note && (
                  <p className="text-xs text-fog-500 mt-1 italic">"{m.note}"</p>
                )}
              </li>
            ))}
          </ul>
        )}

        {showMedForm ? (
          <MedicationForm
            onCancel={() => setShowMedForm(false)}
            onSave={(m) => {
              addMedicationEvent({
                patientId: patient.id,
                ...m,
                time: new Date().toISOString(),
                enteredBy: currentUser.displayName,
                recordedTime: new Date().toISOString(),
              });
              setShowMedForm(false);
            }}
          />
        ) : (
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setShowMedForm(true)}
          >
            + Add medication
          </Button>
        )}
      </Card>

      <Card className="p-5">
        <CardHeading>Dialysis / renal replacement therapy</CardHeading>
        {patientDialysis.length === 0 ? (
          <p className="text-sm text-fog-600">
            No dialysis appointments recorded yet.
          </p>
        ) : (
          <ul className="space-y-3 mb-3">
            {patientDialysis.map((d) => (
              <li
                key={d.id}
                className="rounded-2xl border border-navy-900/10 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-navy-900">
                    {DIALYSIS_MODALITY_LABEL[d.modality]}
                  </span>
                  <Badge tone={d.attended ? "intake" : "alert"}>
                    {d.attended ? "Attended" : "Missed"}
                  </Badge>
                </div>
                <p className="text-sm text-fog-600">
                  {format(new Date(d.scheduledTime), "d MMM, HH:mm")}
                </p>
                {d.note && (
                  <p className="text-xs text-fog-500 mt-1 italic">"{d.note}"</p>
                )}
              </li>
            ))}
          </ul>
        )}

        {showDialysisForm ? (
          <DialysisForm
            onCancel={() => setShowDialysisForm(false)}
            onSave={(d) => {
              addDialysisAppointment({
                patientId: patient.id,
                ...d,
                enteredBy: currentUser.displayName,
                recordedTime: new Date().toISOString(),
              });
              setShowDialysisForm(false);
            }}
          />
        ) : (
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setShowDialysisForm(true)}
          >
            + Log dialysis appointment
          </Button>
        )}

        <p className="text-xs text-fog-500 mt-3">
          Recording an attended session here doesn't log the fluid removed — add
          that as an output entry so it's included in the balance.{" "}
          <Link to="/add/output" className="underline font-semibold">
            Record fluid removed
          </Link>
        </p>
      </Card>

      <Card className="p-5">
        <CardHeading>Questions about a dose or a missed session?</CardHeading>
        <p className="text-sm text-fog-600">
          This app doesn't judge whether your fluid balance is right or whether
          a dose needs changing — that's for your care team. Use{" "}
          <Link to="/summary" className="underline font-semibold">
            Share with care team
          </Link>{" "}
          on the summary screen to send them your recorded intake, output, and
          this log together.
        </p>
      </Card>
    </div>
  );
}

function MedicationForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (m: {
    name: string;
    dose: string;
    frequency: string;
    note?: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("");
  const [note, setNote] = useState("");

  const canSave = name.trim() && dose.trim() && frequency.trim();

  return (
    <div className="space-y-3 rounded-2xl border border-navy-900/10 p-3">
      <Field label="Medicine name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Furosemide"
        />
      </Field>
      <Field label="Dose">
        <Input
          value={dose}
          onChange={(e) => setDose(e.target.value)}
          placeholder="e.g. 40 mg"
        />
      </Field>
      <Field label="Frequency">
        <Input
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          placeholder="e.g. Once daily"
        />
      </Field>
      <Field label="Note (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={!canSave}
          onClick={() =>
            onSave({
              name: name.trim(),
              dose: dose.trim(),
              frequency: frequency.trim(),
              note: note.trim() || undefined,
            })
          }
        >
          Save
        </Button>
      </div>
    </div>
  );
}

const MODALITY_OPTIONS: DialysisModality[] = [
  "haemodialysis",
  "peritoneal_dialysis",
  "crrt",
  "other",
];

const MODALITY_TAB_OPTIONS: { value: DialysisModality; label: string }[] =
  MODALITY_OPTIONS.map((m) => ({
    value: m,
    label: DIALYSIS_MODALITY_LABEL[m],
  }));

function DialysisForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (d: {
    modality: DialysisModality;
    scheduledTime: string;
    attended: boolean;
    note?: string;
  }) => void;
}) {
  const [modality, setModality] = useState<DialysisModality>("haemodialysis");
  const [scheduledTime, setScheduledTime] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [attended, setAttended] = useState(true);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3 rounded-2xl border border-navy-900/10 p-3">
      <div>
        <p className="text-sm font-semibold text-navy-700 mb-1.5">Type</p>
        <SegmentedTabs
          label="Dialysis type"
          value={modality}
          onChange={setModality}
          options={MODALITY_TAB_OPTIONS}
        />
      </div>
      <Field label="Scheduled date & time">
        <Input
          type="datetime-local"
          value={scheduledTime}
          onChange={(e) => setScheduledTime(e.target.value)}
        />
      </Field>
      <div>
        <p className="text-sm font-semibold text-navy-700 mb-1.5">Attendance</p>
        <SegmentedTabs
          label="Attendance"
          value={attended ? "attended" : "missed"}
          onChange={(v) => setAttended(v === "attended")}
          options={[
            { value: "attended", label: "Attended" },
            { value: "missed", label: "Missed" },
          ]}
        />
      </div>
      <Field label="Note (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={() =>
            onSave({
              modality,
              scheduledTime: new Date(scheduledTime).toISOString(),
              attended,
              note: note.trim() || undefined,
            })
          }
        >
          Save
        </Button>
      </div>
    </div>
  );
}
