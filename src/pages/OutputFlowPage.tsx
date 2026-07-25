import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatusBadge } from "../components/ui/Badge";
import { Field, Input } from "../components/ui/Field";
import { NoActivePatientState } from "../components/ui/NoActivePatientState";
import { useStore } from "../store/useStore";
import { useActivePatient } from "../hooks/useFluidData";
import type { MeasurementStatus, OutputCategory } from "../types";
import {
  OUTPUT_CATEGORIES,
  CategoryIcon,
  CATEGORY_LABEL,
} from "../lib/eventMeta";
import {
  OUTPUT_QUICK_AMOUNTS,
  CONTINENCE_SUBTYPES,
  MENSTRUAL_QUALITATIVE,
  UNMEASURED_URINE_SUBTYPES,
  VOMIT_QUALITATIVE,
  SWEATING_LEVELS,
  DIARRHOEA_QUALITATIVE,
} from "../lib/amounts";

export function OutputFlowPage() {
  const navigate = useNavigate();
  const patient = useActivePatient();
  const addEvent = useStore((s) => s.addEvent);
  const currentUser = useStore((s) => s.currentUser);

  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<OutputCategory | null>(null);
  const [subtype, setSubtype] = useState<string | undefined>();
  const [amountMl, setAmountMl] = useState<number | null>(null);
  const [status, setStatus] = useState<MeasurementStatus>("unmeasured");
  const [episodeCount, setEpisodeCount] = useState(1);
  const [note, setNote] = useState("");
  const [rawInput, setRawInput] = useState("");

  if (!patient) return <NoActivePatientState />;

  const confirm = () => setStep(9);

  const save = () => {
    if (!category) return;
    addEvent({
      patientId: patient.id,
      direction: "output",
      category,
      subtype,
      amountMl: amountMl ?? undefined,
      unit: "mL",
      status,
      episodeCount: category === "diarrhoea" ? episodeCount : undefined,
      eventTime: new Date().toISOString(),
      enteredBy: currentUser.displayName,
      enteredByRole: currentUser.role,
      inputMethod: "manual",
      note: note || undefined,
    });
    navigate("/");
  };

  const pickCategory = (c: OutputCategory) => {
    setCategory(c);
    setSubtype(undefined);
    setAmountMl(null);
    setStatus("unmeasured");
    setStep(2);
  };

  return (
    <div className="max-w-lg mx-auto pb-8">
      <StepHeader
        onBack={() => (step > 1 ? setStep(step === 9 ? 2 : 1) : navigate(-1))}
        title="Record output or loss"
      />

      {step === 1 && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          {OUTPUT_CATEGORIES.filter(
            (c) => c !== "menstrual_pad" || patient.sex === "female"
          ).map((c) => (
            <button
              key={c}
              onClick={() => pickCategory(c)}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-white border border-navy-900/10 py-4 hover:border-output-500 hover:bg-output-50 min-h-24"
            >
              <CategoryIcon
                category={c}
                size={24}
                className="text-output-600"
                aria-hidden="true"
              />
              <span className="text-xs font-semibold text-navy-800 text-center">
                {CATEGORY_LABEL[c]}
              </span>
            </button>
          ))}
        </div>
      )}

      {step === 2 && category === "urine" && (
        <div className="mt-4 space-y-3">
          <MethodButton
            label="Measured urine"
            desc="Exact volume, e.g. measured in a bottle or jug"
            onClick={() => setStep(3)}
          />
          <p className="text-sm font-semibold text-navy-700 pt-2">
            Or, unmeasured:
          </p>
          <ChipGrid
            options={UNMEASURED_URINE_SUBTYPES}
            onPick={(v) => {
              setSubtype(v);
              setStatus("unmeasured");
              confirm();
            }}
          />
        </div>
      )}
      {step === 3 && category === "urine" && (
        <ExactVolumeStep
          amounts={OUTPUT_QUICK_AMOUNTS}
          raw={rawInput}
          setRaw={setRawInput}
          onDone={(ml) => {
            setAmountMl(ml);
            setStatus("measured");
            confirm();
          }}
        />
      )}

      {step === 2 && category === "continence" && (
        <div className="mt-4">
          <ChipGrid
            options={CONTINENCE_SUBTYPES}
            onPick={(v) => {
              setSubtype(v);
              setStatus("unmeasured");
              confirm();
            }}
          />
        </div>
      )}

      {step === 2 && category === "menstrual_pad" && (
        <div className="mt-4">
          <ChipGrid
            options={MENSTRUAL_QUALITATIVE}
            onPick={(v) => {
              setSubtype(v);
              setStatus("unmeasured");
              confirm();
            }}
          />
        </div>
      )}

      {step === 2 && category === "vomit" && (
        <div className="mt-4 space-y-3">
          <MethodButton
            label="Measured volume"
            desc="Exact volume known"
            onClick={() => setStep(3)}
          />
          <p className="text-sm font-semibold text-navy-700 pt-2">
            Or, an approximate amount:
          </p>
          <ChipGrid
            options={VOMIT_QUALITATIVE}
            onPick={(v) => {
              setSubtype(v);
              setStatus("unmeasured");
              confirm();
            }}
          />
        </div>
      )}
      {step === 3 && category === "vomit" && (
        <ExactVolumeStep
          amounts={[50, 100, 150, 200, 300]}
          raw={rawInput}
          setRaw={setRawInput}
          onDone={(ml) => {
            setAmountMl(ml);
            setStatus("measured");
            confirm();
          }}
        />
      )}

      {step === 2 && category === "diarrhoea" && (
        <div className="mt-4 space-y-5">
          <div>
            <p className="text-sm font-semibold text-navy-700 mb-2">
              Number of episodes
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setEpisodeCount((n) => Math.max(1, n - 1))}
                className="min-h-12 min-w-12 rounded-full bg-white border border-navy-900/15 text-xl font-bold"
              >
                −
              </button>
              <span className="text-2xl font-extrabold w-8 text-center">
                {episodeCount}
              </span>
              <button
                onClick={() => setEpisodeCount((n) => n + 1)}
                className="min-h-12 min-w-12 rounded-full bg-white border border-navy-900/15 text-xl font-bold"
              >
                +
              </button>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-700 mb-2">
              Consistency and amount
            </p>
            <ChipGrid
              options={DIARRHOEA_QUALITATIVE.map((d) => ({
                value: d.value,
                label: `Watery, ${d.label.toLowerCase()}`,
              }))}
              onPick={(v) => {
                setSubtype(`watery_${v}`);
                setStatus("unmeasured");
                confirm();
              }}
            />
          </div>
          <MethodButton
            label="I have a genuinely measured volume"
            desc="Only if actually measured, e.g. bedpan"
            onClick={() => setStep(3)}
          />
        </div>
      )}
      {step === 3 && category === "diarrhoea" && (
        <ExactVolumeStep
          amounts={[50, 100, 150, 200]}
          raw={rawInput}
          setRaw={setRawInput}
          onDone={(ml) => {
            setAmountMl(ml);
            setStatus("measured");
            setSubtype("watery_measured");
            confirm();
          }}
        />
      )}

      {step === 2 &&
        (category === "stoma" ||
          category === "drain" ||
          category === "nasogastric" ||
          category === "dialysis") && (
          <div className="mt-4 space-y-3">
            <MethodButton
              label="Exact volume"
              desc="Known volume, e.g. from a drainage bag"
              onClick={() => setStep(3)}
            />
            <MethodButton
              label="Unmeasured event"
              desc="An event occurred but no volume is known"
              onClick={() => {
                setStatus("unmeasured");
                confirm();
              }}
            />
          </div>
        )}
      {step === 3 &&
        (category === "stoma" ||
          category === "drain" ||
          category === "nasogastric" ||
          category === "dialysis") && (
          <ExactVolumeStep
            amounts={OUTPUT_QUICK_AMOUNTS}
            raw={rawInput}
            setRaw={setRawInput}
            onDone={(ml) => {
              setAmountMl(ml);
              setStatus("measured");
              confirm();
            }}
          />
        )}

      {step === 2 && category === "sweating" && (
        <div className="mt-4">
          <p className="text-sm text-fog-600 mb-3">
            Sweating is recorded as an additional potential loss — it is not
            converted into a precise volume.
          </p>
          <ChipGrid
            options={SWEATING_LEVELS}
            onPick={(v) => {
              setSubtype(v);
              setStatus("unmeasured");
              confirm();
            }}
          />
        </div>
      )}

      {step === 2 && category === "other_output" && (
        <div className="mt-4 space-y-3">
          <MethodButton
            label="Exact volume"
            desc="Known volume in mL"
            onClick={() => setStep(3)}
          />
          <MethodButton
            label="Unmeasured event"
            desc="An event occurred but no volume is known"
            onClick={() => {
              setStatus("unmeasured");
              confirm();
            }}
          />
        </div>
      )}
      {step === 3 && category === "other_output" && (
        <ExactVolumeStep
          amounts={OUTPUT_QUICK_AMOUNTS}
          raw={rawInput}
          setRaw={setRawInput}
          onDone={(ml) => {
            setAmountMl(ml);
            setStatus("measured");
            confirm();
          }}
        />
      )}

      {step === 9 && category && (
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
                No volume recorded — this will be saved as an unmeasured event
                and shown separately from the numerical balance.
              </p>
            )}
            {subtype && (
              <p className="text-sm text-fog-600 capitalize">
                {subtype.replace(/_/g, " ")}
              </p>
            )}
            {category === "diarrhoea" && (
              <p className="text-sm text-fog-600">
                {episodeCount} episode{episodeCount > 1 ? "s" : ""}
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
          </Card>
          <Button fullWidth size="xl" variant="output" onClick={save}>
            Confirm and save
          </Button>
        </div>
      )}
    </div>
  );
}

function StepHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        aria-label="Go back"
        className="min-h-11 min-w-11 flex items-center justify-center rounded-full hover:bg-fog-100 text-xl"
      >
        ←
      </button>
      <h1 className="text-lg font-extrabold text-navy-900 flex-1">{title}</h1>
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
      className="w-full text-left rounded-2xl bg-white border border-navy-900/10 px-4 py-4 hover:border-output-500 hover:bg-output-50"
    >
      <div className="font-bold text-navy-900">{label}</div>
      <div className="text-sm text-fog-500">{desc}</div>
    </button>
  );
}

function ChipGrid({
  options,
  onPick,
}: {
  options: { value: string; label: string }[];
  onPick: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onPick(o.value)}
          className="rounded-2xl bg-white border border-navy-900/10 py-4 px-2 font-bold text-navy-800 text-sm hover:border-fog-500 hover:bg-fog-100"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ExactVolumeStep({
  amounts,
  raw,
  setRaw,
  onDone,
}: {
  amounts: number[];
  raw: string;
  setRaw: (v: string) => void;
  onDone: (ml: number) => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {amounts.map((a) => (
          <button
            key={a}
            onClick={() => onDone(a)}
            className="rounded-2xl bg-white border border-navy-900/10 py-4 font-bold text-navy-800 hover:border-output-500 hover:bg-output-50"
          >
            {a} mL
          </button>
        ))}
      </div>
      <p className="text-sm font-semibold text-navy-700">
        Or enter a precise amount
      </p>
      <div className="flex gap-2">
        <Input
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="mL"
          aria-label="Volume in mL"
          className="flex-1 text-2xl font-bold py-3"
        />
        <Button disabled={!raw} onClick={() => onDone(parseFloat(raw))}>
          Use
        </Button>
      </div>
    </div>
  );
}
