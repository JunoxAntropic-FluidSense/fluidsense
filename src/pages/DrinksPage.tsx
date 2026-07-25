import { useState, type ReactNode } from "react";
import { useEscapeClose } from "../hooks/useEscapeClose";
import { useStore } from "../store/useStore";
import { useActivePatient } from "../hooks/useFluidData";
import { Card, CardHeading } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import {
  CATEGORY_ICON,
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

  const [showNewDrink, setShowNewDrink] = useState(false);
  const [showNewContainer, setShowNewContainer] = useState(false);

  if (!patient) return null;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">
          {mode === "healthcare" ? "Patient fluid library" : "My drinks"}
        </h1>
        <p className="text-sm text-fog-600">
          Teach FluidSense about commonly consumed drinks so quick-add and voice
          entry can recognise them.
        </p>
      </div>

      <Card className="p-5">
        <CardHeading
          action={
            <Button
              size="md"
              variant="secondary"
              onClick={() => setShowNewContainer(true)}
            >
              Add container
            </Button>
          }
        >
          Saved containers
        </CardHeading>
        {patient.containers.length === 0 ? (
          <p className="text-sm text-fog-600">
            No personal containers saved yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {patient.containers.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-xl bg-fog-50 px-3 py-2.5"
              >
                <span className="font-semibold text-navy-800">{c.name}</span>
                <span className="text-sm text-fog-600">
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
          <div className="text-center py-4">
            <p className="font-bold text-navy-900">No favourite drinks saved</p>
            <p className="text-sm text-fog-600 mt-1">
              Teach FluidSense about a cup, mug, bottle or drink you use
              regularly.
            </p>
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
                        <span aria-hidden="true">
                          {CATEGORY_ICON[fp.category]}
                        </span>
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
                      className={`text-2xl min-h-11 min-w-11 ${isFav ? "text-amber-500" : "text-fog-300"}`}
                    >
                      {isFav ? "★" : "☆"}
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
      <label className="block text-sm font-semibold text-navy-700">
        Container name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Blue mug"
          className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
        />
      </label>
      <label className="block text-sm font-semibold text-navy-700 mt-3">
        Full volume (mL)
        <input
          inputMode="decimal"
          value={vol}
          onChange={(e) => setVol(e.target.value)}
          placeholder="e.g. 300"
          className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
        />
      </label>
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
        <label className="block text-sm font-semibold text-navy-700">
          Fluid name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning porridge drink"
            className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold text-navy-700">
          Brand (optional)
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold text-navy-700">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as FluidCategory)}
            className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
          >
            {INTAKE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-navy-700">
          Usual container
          <select
            value={containerId}
            onChange={(e) => setContainerId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
          >
            <option value="">Enter volume manually</option>
            {containers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.fullVolumeMl} mL)
              </option>
            ))}
          </select>
        </label>
        {!containerId && (
          <label className="block text-sm font-semibold text-navy-700">
            Container volume (mL)
            <input
              inputMode="decimal"
              value={customVol}
              onChange={(e) => setCustomVol(e.target.value)}
              className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
            />
          </label>
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
        <label className="block text-sm font-semibold text-navy-700">
          Water-content estimate % (optional)
          <input
            inputMode="decimal"
            value={waterPct}
            onChange={(e) => setWaterPct(e.target.value)}
            placeholder="e.g. 90"
            className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
          />
        </label>
        {waterPct && (
          <label className="block text-sm font-semibold text-navy-700">
            Source of water-content estimate
            <input
              value={waterSource}
              onChange={(e) => setWaterSource(e.target.value)}
              placeholder="e.g. User-entered estimate"
              className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"
            />
          </label>
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
