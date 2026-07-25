import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatusBadge } from "../components/ui/Badge";
import { Field, Input } from "../components/ui/Field";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import {
  PhotoCaptureField,
  type PhotoAttachHandle,
} from "../components/photo/PhotoCaptureField";
import { useStore } from "../store/useStore";
import { useActivePatient } from "../hooks/useFluidData";
import type {
  FluidCategory,
  MeasurementStatus,
  SavedContainer,
} from "../types";
import {
  INTAKE_CATEGORIES,
  CategoryIcon,
  CATEGORY_LABEL,
} from "../lib/eventMeta";
import { APPROX_INTAKE_AMOUNTS, CONTAINER_FRACTIONS } from "../lib/amounts";

type Method = "exact" | "saved" | "standard" | "approx" | "unknown";

const STANDARD_CONTAINERS: SavedContainer[] = [
  {
    id: "std-hospital-cup",
    name: "Hospital cup",
    fullVolumeMl: 180,
    isStandard: true,
  },
  {
    id: "std-water-glass",
    name: "Water glass",
    fullVolumeMl: 250,
    isStandard: true,
  },
  { id: "std-mug", name: "Standard mug", fullVolumeMl: 250, isStandard: true },
  {
    id: "std-bottle",
    name: "Standard bottle",
    fullVolumeMl: 500,
    isStandard: true,
  },
  {
    id: "std-soup-bowl",
    name: "Soup bowl",
    fullVolumeMl: 350,
    isStandard: true,
  },
];

export function IntakeFlowPage() {
  const navigate = useNavigate();
  const patient = useActivePatient();
  const addEvent = useStore((s) => s.addEvent);
  const updateEvent = useStore((s) => s.updateEvent);
  const currentUser = useStore((s) => s.currentUser);

  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<FluidCategory | null>(null);
  const [method, setMethod] = useState<Method | null>(null);
  const [amountMl, setAmountMl] = useState<number | null>(null);
  const [status, setStatus] = useState<MeasurementStatus>("measured");
  const [container, setContainer] = useState<SavedContainer | null>(null);
  const [fraction, setFraction] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [unitInput, setUnitInput] = useState<"mL" | "L">("mL");
  const [rawInput, setRawInput] = useState("");
  const [photoHandle, setPhotoHandle] = useState<PhotoAttachHandle | null>(
    null
  );

  if (!patient) return null;

  const reset = () => {
    setStep(1);
    setCategory(null);
    setMethod(null);
    setAmountMl(null);
    setContainer(null);
    setFraction(null);
    setNote("");
    setRawInput("");
    setPhotoHandle(null);
  };

  const goConfirm = () => setStep(4);

  const save = async () => {
    if (!category) return;
    const createdEvent = addEvent({
      patientId: patient.id,
      direction: "intake",
      category,
      amountMl: amountMl ?? undefined,
      unit: "mL",
      status,
      containerId: container?.id,
      containerFraction: fraction ?? undefined,
      eventTime: new Date().toISOString(),
      enteredBy: currentUser.displayName,
      enteredByRole: currentUser.role,
      inputMethod: "manual",
      note: note || undefined,
    });

    if (photoHandle) {
      try {
        const result = await photoHandle.attach(patient.id, createdEvent.id);
        if (result.path) {
          updateEvent(
            createdEvent.id,
            { photoStoragePath: result.path },
            currentUser.displayName,
            "Attached photo"
          );
        }
      } catch {
        // Photo attach failure must not block or roll back the fluid entry
        // itself — the event above is already saved either way.
      }
    }

    navigate("/");
  };

  return (
    <div className="max-w-lg mx-auto pb-8">
      <StepHeader
        step={step}
        total={4}
        onBack={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
        title="Record intake"
      />

      {step === 1 && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          {INTAKE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => {
                setCategory(c);
                setStatus("measured");
                setStep(2);
              }}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-white border border-navy-900/10 py-4 hover:border-intake-500 hover:bg-intake-50 min-h-24"
            >
              <CategoryIcon
                category={c}
                size={24}
                className="text-intake-600"
                aria-hidden="true"
              />
              <span className="text-xs font-semibold text-navy-800 text-center">
                {CATEGORY_LABEL[c]}
              </span>
            </button>
          ))}
        </div>
      )}

      {step === 2 && category && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-fog-600 mb-2">
            How was the amount measured for this{" "}
            {CATEGORY_LABEL[category].toLowerCase()}?
          </p>
          <MethodButton
            label="Exact volume"
            desc="I know exactly how much, in mL or litres"
            onClick={() => {
              setMethod("exact");
              setStep(3);
            }}
          />
          <MethodButton
            label="Saved cup or container"
            desc="Use one of your personal containers"
            onClick={() => {
              setMethod("saved");
              setStep(3);
            }}
          />
          <MethodButton
            label="Standard container"
            desc="Hospital cup, water glass, bowl, etc."
            onClick={() => {
              setMethod("standard");
              setStep(3);
            }}
          />
          <MethodButton
            label="Approximate amount"
            desc="A rough amount, like a sip or a cup"
            onClick={() => {
              setMethod("approx");
              setStep(3);
            }}
          />
          <MethodButton
            label="Unknown amount"
            desc="An event happened but no volume is known"
            onClick={() => {
              setMethod("unknown");
              setStatus("unmeasured");
              setAmountMl(null);
              goConfirm();
            }}
          />
        </div>
      )}

      {step === 3 && method === "exact" && (
        <div className="mt-4 space-y-4">
          <SegmentedTabs
            label="Unit"
            value={unitInput}
            onChange={setUnitInput}
            options={[
              { value: "mL", label: "mL" },
              { value: "L", label: "Litres" },
            ]}
          />
          <Input
            inputMode="decimal"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder={unitInput === "mL" ? "e.g. 250" : "e.g. 0.5"}
            aria-label={`Volume in ${unitInput}`}
            className="text-3xl font-bold py-4"
          />
          <Button
            fullWidth
            disabled={!rawInput}
            onClick={() => {
              const val = parseFloat(rawInput);
              setAmountMl(unitInput === "L" ? val * 1000 : val);
              setStatus("measured");
              goConfirm();
            }}
          >
            Continue
          </Button>
        </div>
      )}

      {step === 3 && method === "saved" && (
        <ContainerPicker
          containers={patient.containers.filter((c) => !c.isStandard)}
          emptyHint="You have no personal saved containers yet. Add one from My drinks."
          onPick={(c) => setContainer(c)}
          selected={container}
        />
      )}
      {step === 3 && method === "standard" && (
        <ContainerPicker
          containers={STANDARD_CONTAINERS}
          onPick={(c) => setContainer(c)}
          selected={container}
        />
      )}
      {step === 3 &&
        (method === "saved" || method === "standard") &&
        container && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {CONTAINER_FRACTIONS.map((f) => (
              <button
                key={f.label}
                onClick={() => {
                  setFraction(f.value);
                  setAmountMl(Math.round(container.fullVolumeMl * f.value));
                  setStatus("container_estimated");
                  goConfirm();
                }}
                className="rounded-2xl bg-white border border-navy-900/10 py-4 font-bold text-navy-800 hover:border-amber-500 hover:bg-amber-50"
              >
                {f.label}
                <div className="text-xs font-normal text-fog-500 mt-1">
                  ≈ {Math.round(container.fullVolumeMl * f.value)} mL
                </div>
              </button>
            ))}
          </div>
        )}

      {step === 3 && method === "approx" && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {APPROX_INTAKE_AMOUNTS.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                setAmountMl(a.ml);
                setStatus("approximate");
                goConfirm();
              }}
              className="rounded-2xl bg-white border border-navy-900/10 py-4 font-bold text-navy-800 hover:border-amber-500 hover:bg-amber-50"
            >
              {a.label}
              <div className="text-xs font-normal text-fog-500 mt-1">
                ≈ {a.ml} mL
              </div>
            </button>
          ))}
          <button
            onClick={() => {
              setAmountMl(null);
              setStatus("approximate");
              setMethod("approx");
              setStep(3.5 as unknown as number);
            }}
            className="rounded-2xl bg-white border border-navy-900/10 py-4 font-bold text-navy-800 hover:border-amber-500 col-span-2"
          >
            Other approximate amount
          </button>
        </div>
      )}

      {step === 3.5 && (
        <div className="mt-4 space-y-4">
          <Input
            inputMode="decimal"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Approximate mL"
            aria-label="Approximate volume in mL"
            className="text-3xl font-bold py-4"
          />
          <Button
            fullWidth
            disabled={!rawInput}
            onClick={() => {
              setAmountMl(parseFloat(rawInput));
              goConfirm();
            }}
          >
            Continue
          </Button>
        </div>
      )}

      {step === 4 && category && (
        <div className="mt-4 space-y-4">
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-navy-900">
                {CATEGORY_LABEL[category]}
              </span>
              <StatusBadge status={status} />
            </div>
            {amountMl != null ? (
              <p className="text-3xl font-extrabold text-navy-900">
                {Math.round(amountMl)} mL
              </p>
            ) : (
              <p className="text-sm text-fog-600">
                No volume recorded — this will be saved as an unmeasured event.
              </p>
            )}
            {container && (
              <p className="text-sm text-fog-600">
                {fraction ? `${fraction * 100}% of ` : ""}
                {container.name} ({container.fullVolumeMl} mL full)
              </p>
            )}
            <p className="text-sm text-fog-600">Time: now</p>
            <Field label="Optional note" className="pt-1">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional)"
              />
            </Field>
            <PhotoCaptureField
              onAcceptEstimate={(estimatedMl) => {
                setAmountMl(estimatedMl);
                setStatus("approximate");
              }}
              onAttach={setPhotoHandle}
            />
          </Card>
          <Button fullWidth size="xl" onClick={save}>
            Confirm and save
          </Button>
          <Button fullWidth variant="ghost" onClick={reset}>
            Start over
          </Button>
        </div>
      )}
    </div>
  );
}

function StepHeader({
  step,
  total,
  onBack,
  title,
}: {
  step: number;
  total: number;
  onBack: () => void;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        aria-label="Go back"
        className="min-h-11 min-w-11 flex items-center justify-center rounded-full hover:bg-fog-100 text-xl"
      >
        ←
      </button>
      <div className="flex-1">
        <h1 className="text-lg font-extrabold text-navy-900">{title}</h1>
        <p className="text-xs text-fog-500">
          Step {Math.min(Math.ceil(step), total)} of {total}
        </p>
      </div>
    </div>
  );
}

function MethodButton({
  label,
  desc,
  onClick,
}: {
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl bg-white border border-navy-900/10 px-4 py-4 hover:border-intake-500 hover:bg-intake-50"
    >
      <div className="font-bold text-navy-900">{label}</div>
      <div className="text-sm text-fog-500">{desc}</div>
    </button>
  );
}

function ContainerPicker({
  containers,
  onPick,
  selected,
  emptyHint,
}: {
  containers: SavedContainer[];
  onPick: (c: SavedContainer) => void;
  selected: SavedContainer | null;
  emptyHint?: string;
}) {
  if (containers.length === 0) {
    return (
      <p className="mt-4 text-sm text-fog-600">
        {emptyHint ?? "No containers available."}
      </p>
    );
  }
  return (
    <div className="mt-4 grid grid-cols-1 gap-3">
      {containers.map((c) => (
        <button
          key={c.id}
          onClick={() => onPick(c)}
          className={`text-left rounded-2xl border px-4 py-3 font-semibold ${selected?.id === c.id ? "border-intake-600 bg-intake-50" : "border-navy-900/10 bg-white hover:border-intake-400"}`}
        >
          {c.name}{" "}
          <span className="text-fog-500 font-normal">
            — {c.fullVolumeMl} mL full
          </span>
        </button>
      ))}
    </div>
  );
}
