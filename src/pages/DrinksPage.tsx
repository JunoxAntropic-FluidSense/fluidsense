import { useState, type ReactNode } from "react";
import { Star } from "@phosphor-icons/react";
import { useEscapeClose } from "../hooks/useEscapeClose";
import { useStore } from "../store/useStore";
import { useActivePatient } from "../hooks/useFluidData";
import { Card, CardHeading } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import { Field, Input, Select } from "../components/ui/Field";
import { NoActivePatientState } from "../components/ui/NoActivePatientState";
import {
  CategoryIcon,
  CATEGORY_LABEL,
  INTAKE_CATEGORIES,
} from "../lib/eventMeta";
import type { FluidCategory } from "../types";

const SERVING_FRACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "0.25", label: "Quarter" },
  { value: "0.5", label: "Half" },
  { value: "0.75", label: "Three quarters" },
  { value: "1", label: "Full" },
];

export function DrinksPage() {
  const patient = useActivePatient();
  const mode = useStore((s) => s.mode);
  const fluidProfiles = useStore((s) => s.fluidProfiles);
  const addFluidProfile = useStore((s) => s.addFluidProfile);
  const toggleFavouriteFluid = useStore((s) => s.toggleFavouriteFluid);
  const addContainer = useStore((s) => s.addContainer);
  const loadStandardPresets = useStore((s) => s.loadStandardPresets);

  const [showNewDrink, setShowNewDrink] = useState(false);
  const [showNewContainer, setShowNewContainer] = useState(false);

  if (!patient) return <NoActivePatientState />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">
            {mode === "healthcare" ? "Patient fluid library" : "My drinks"}
          </h1>
          <p className="text-sm text-fog-600">
            Teach FluidSense about commonly consumed drinks so quick-add and
            voice entry can recognise them.
          </p>
        </div>
        <Button
          size="md"
          variant="secondary"
          onClick={() => loadStandardPresets(patient.id)}
        >
          Load Standard Presets
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        <Card className="p-5">
          <CardHeading
            action={
              <div className="flex gap-2">
                <Button
                  size="md"
                  variant="secondary"
                  onClick={() => setShowNewContainer(true)}
                >
                  Add container
                </Button>
              </div>
            }
          >
            Saved containers
          </CardHeading>
          {patient.containers.length === 0 ? (
            <div className="text-center py-5 space-y-2">
              <p className="text-sm text-fog-600">
                No personal containers saved yet.
              </p>
              <Button
                size="md"
                variant="secondary"
                onClick={() => loadStandardPresets(patient.id)}
              >
                Prefill UK/NHS Standard Containers & Drinks
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {patient.containers.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-xl bg-fog-50 px-3 py-2.5"
                >
                  <span className="font-semibold text-navy-800">{c.name}</span>
                  <span className="text-sm text-fog-600 font-mono font-medium">
                    {c.fullVolumeMl} mL full
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <CardHeading
            action={
              <Button size="md" onClick={() => setShowNewDrink(true)}>
                Add drink
              </Button>
            }
          >
            Fluid profiles
          </CardHeading>
          {fluidProfiles.length === 0 ? (
            <div className="text-center py-5 space-y-2">
              <p className="font-bold text-navy-900">
                No favourite drinks saved
              </p>
              <p className="text-sm text-fog-600">
                Teach FluidSense about a cup, mug, bottle or drink you use
                regularly.
              </p>
              <Button size="md" onClick={() => loadStandardPresets(patient.id)}>
                Prefill Standard Drinks Library
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {fluidProfiles.map((fp) => {
                const isFav = patient.favouriteFluidIds.includes(fp.id);
                const consumed =
                  fp.containerVolumeMl && fp.usualServingFraction != null
                    ? Math.round(fp.containerVolumeMl * fp.usualServingFraction)
                    : undefined;
                const waterMl =
                  consumed && fp.waterContentPercent
                    ? Math.round(consumed * (fp.waterContentPercent / 100))
                    : undefined;
                return (
                  <li
                    key={fp.id}
                    className="rounded-2xl border border-navy-900/10 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CategoryIcon
                            category={fp.category}
                            size={18}
                            aria-hidden="true"
                          />
                          <span className="font-bold text-navy-900">
                            {fp.name}
                          </span>
                          <Badge tone={fp.verified ? "intake" : "amber"}>
                            {fp.verified ? "Verified" : "Personalised estimate"}
                          </Badge>
                        </div>
                        {fp.brand && (
                          <p className="text-xs text-fog-500">{fp.brand}</p>
                        )}
                      </div>
                      <button
                        onClick={() => toggleFavouriteFluid(patient.id, fp.id)}
                        aria-pressed={isFav}
                        aria-label={
                          isFav
                            ? `Remove ${fp.name} from favourites`
                            : `Add ${fp.name} to favourites`
                        }
                        className={`flex items-center justify-center min-h-11 min-w-11 ${isFav ? "text-amber-500" : "text-fog-300"}`}
                      >
                        <Star size={22} weight={isFav ? "fill" : "regular"} />
                      </button>
                    </div>
                    <div className="mt-2 text-sm text-fog-600 space-y-1">
                      {consumed != null && (
                        <p>
                          Consumed volume (usual serving):{" "}
                          <span className="font-semibold text-navy-800">
                            {consumed} mL
                          </span>
                        </p>
                      )}
                      {fp.waterContentPercent != null && (
                        <p>
                          Estimated water contribution:{" "}
                          <span className="font-semibold text-navy-800">
                            {waterMl} mL
                          </span>{" "}
                          <span className="text-fog-500">
                            ({fp.waterContentPercent}% water-content estimate —{" "}
                            {fp.waterContentSource})
                          </span>
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {showNewContainer && (
        <NewContainerModal
          onClose={() => setShowNewContainer(false)}
          onSave={(name, vol) => {
            addContainer(patient.id, { name, fullVolumeMl: vol });
            setShowNewContainer(false);
          }}
        />
      )}
      {showNewDrink && (
        <NewDrinkModal
          containers={patient.containers}
          onClose={() => setShowNewDrink(false)}
          onSave={(profile) => {
            addFluidProfile(profile);
            setShowNewDrink(false);
          }}
        />
      )}
    </div>
  );
}

function NewContainerModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (name: string, vol: number) => void;
}) {
  const [name, setName] = useState("");
  const [vol, setVol] = useState("");
  return (
    <Modal title="Add a container" onClose={onClose}>
      <Field label="Container name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Blue mug"
        />
      </Field>
      <Field label="Full volume (mL)" className="mt-3">
        <Input
          inputMode="decimal"
          value={vol}
          onChange={(e) => setVol(e.target.value)}
          placeholder="e.g. 300"
        />
      </Field>
      <Button
        fullWidth
        className="mt-4"
        disabled={!name || !vol}
        onClick={() => onSave(name, parseFloat(vol))}
      >
        Save container
      </Button>
    </Modal>
  );
}

function NewDrinkModal({
  containers,
  onClose,
  onSave,
}: {
  containers: { id: string; name: string; fullVolumeMl: number }[];
  onClose: () => void;
  onSave: (p: {
    name: string;
    brand?: string;
    category: FluidCategory;
    containerId?: string;
    containerVolumeMl?: number;
    usualServingFraction?: number;
    waterContentPercent?: number;
    waterContentSource?: string;
    verified: boolean;
    favourite: boolean;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<FluidCategory>("water");
  const [containerId, setContainerId] = useState("");
  const [customVol, setCustomVol] = useState("");
  const [fraction, setFraction] = useState("1");
  const [waterPct, setWaterPct] = useState("");
  const [waterSource, setWaterSource] = useState("");

  const container = containers.find((c) => c.id === containerId);
  const vol = container
    ? container.fullVolumeMl
    : parseFloat(customVol) || undefined;

  return (
    <Modal title="Teach FluidSense a new drink" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Fluid name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning porridge drink"
          />
        </Field>
        <Field label="Brand (optional)">
          <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
        </Field>
        <Field label="Category">
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as FluidCategory)}
          >
            {INTAKE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Usual container">
          <Select
            value={containerId}
            onChange={(e) => setContainerId(e.target.value)}
          >
            <option value="">Enter volume manually</option>
            {containers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.fullVolumeMl} mL)
              </option>
            ))}
          </Select>
        </Field>
        {!containerId && (
          <Field label="Container volume (mL)">
            <Input
              inputMode="decimal"
              value={customVol}
              onChange={(e) => setCustomVol(e.target.value)}
            />
          </Field>
        )}
        <div>
          <p className="text-sm font-semibold text-navy-700 mb-1.5">
            Usual serving
          </p>
          <SegmentedTabs
            label="Usual serving"
            value={fraction}
            onChange={setFraction}
            options={SERVING_FRACTION_OPTIONS}
          />
        </div>
        <Field label="Water-content estimate % (optional)">
          <Input
            inputMode="decimal"
            value={waterPct}
            onChange={(e) => setWaterPct(e.target.value)}
            placeholder="e.g. 90"
          />
        </Field>
        {waterPct && (
          <Field label="Source of water-content estimate">
            <Input
              value={waterSource}
              onChange={(e) => setWaterSource(e.target.value)}
              placeholder="e.g. User-entered estimate"
            />
          </Field>
        )}
        <Button
          fullWidth
          disabled={!name || !vol}
          onClick={() =>
            onSave({
              name,
              brand: brand || undefined,
              category,
              containerId: containerId || undefined,
              containerVolumeMl: vol,
              usualServingFraction: parseFloat(fraction),
              waterContentPercent: waterPct ? parseFloat(waterPct) : undefined,
              waterContentSource: waterPct
                ? waterSource || "User-entered estimate"
                : undefined,
              verified: false,
              favourite: true,
            })
          }
        >
          Save drink
        </Button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEscapeClose(onClose);
  return (
    <div
      className="fixed inset-0 z-40 flex items-end md:items-center md:justify-center bg-navy-950/40"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white w-full md:max-w-md md:rounded-3xl rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-navy-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="min-h-11 min-w-11 rounded-full hover:bg-fog-100 text-xl"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
