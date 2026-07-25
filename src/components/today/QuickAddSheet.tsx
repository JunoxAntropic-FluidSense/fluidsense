import { useState } from "react";
import { useEscapeClose } from "../../hooks/useEscapeClose";
import { useStore } from "../../store/useStore";
import { useActivePatient } from "../../hooks/useFluidData";
import type {
  FluidCategory,
  MeasurementStatus,
  OutputCategory,
} from "../../types";
import { CATEGORY_ICON } from "../../lib/eventMeta";
import {
  APPROX_INTAKE_AMOUNTS,
  CONTINENCE_SUBTYPES,
  UNMEASURED_URINE_SUBTYPES,
  VOMIT_QUALITATIVE,
  SWEATING_LEVELS,
  DIARRHOEA_QUALITATIVE,
  OUTPUT_QUICK_AMOUNTS,
} from "../../lib/amounts";
import { Button } from "../ui/Button";

interface Props {
  kind: "intake" | "output";
  category: FluidCategory | OutputCategory;
  label: string;
  onClose: () => void;
}

export function QuickAddSheet({ kind, category, label, onClose }: Props) {
  useEscapeClose(onClose);
  const patient = useActivePatient();
  const addEvent = useStore((s) => s.addEvent);
  const fluidProfiles = useStore((s) => s.fluidProfiles);
  const currentUser = useStore((s) => s.currentUser);
  const [customMl, setCustomMl] = useState("");

  if (!patient) return null;

  const favourite = fluidProfiles.find(
    (fp) =>
      fp.category === category && patient.favouriteFluidIds.includes(fp.id)
  );

  const log = (fields: {
    amountMl?: number;
    status: MeasurementStatus;
    subtype?: string;
    note?: string;
    fluidProfileId?: string;
    containerFraction?: number;
    waterContentPercent?: number;
    estimatedWaterContributionMl?: number;
  }) => {
    addEvent({
      patientId: patient.id,
      direction: kind,
      category,
      unit: "mL",
      eventTime: new Date().toISOString(),
      enteredBy: currentUser.displayName,
      inputMethod: "tap",
      ...fields,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end md:items-center md:justify-center bg-navy-950/40"
      role="dialog"
      aria-modal="true"
      aria-label={`Quick add: ${label}`}
    >
      <div className="bg-white w-full md:max-w-md md:rounded-3xl rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-navy-900 flex items-center gap-2">
            <span aria-hidden="true">{CATEGORY_ICON[category]}</span> {label}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="min-h-11 min-w-11 rounded-full hover:bg-fog-100 text-xl"
          >
            ×
          </button>
        </div>

        {kind === "intake" && (
          <div className="space-y-4">
            {favourite && (
              <button
                onClick={() => {
                  const frac = favourite.usualServingFraction ?? 1;
                  const vol = Math.round(
                    (favourite.containerVolumeMl ?? 250) * frac
                  );
                  const waterMl = favourite.waterContentPercent
                    ? Math.round(vol * (favourite.waterContentPercent / 100))
                    : undefined;
                  log({
                    amountMl: vol,
                    status: favourite.containerId
                      ? "container_estimated"
                      : "measured",
                    fluidProfileId: favourite.id,
                    containerFraction: frac,
                    waterContentPercent: favourite.waterContentPercent,
                    estimatedWaterContributionMl: waterMl,
                  });
                }}
                className="w-full text-left rounded-2xl border-2 border-intake-500 bg-intake-50 px-4 py-4"
              >
                <div className="font-bold text-intake-700">
                  Usual: {favourite.name}
                </div>
                <div className="text-sm text-intake-700/80">
                  {Math.round(
                    (favourite.containerVolumeMl ?? 250) *
                      (favourite.usualServingFraction ?? 1)
                  )}{" "}
                  mL
                </div>
              </button>
            )}
            <div>
              <p className="text-sm font-semibold text-navy-700 mb-2">
                Approximate amount
              </p>
              <div className="grid grid-cols-2 gap-3">
                {APPROX_INTAKE_AMOUNTS.map((a) => (
                  <button
                    key={a.label}
                    onClick={() =>
                      log({ amountMl: a.ml, status: "approximate" })
                    }
                    className="rounded-2xl bg-white border border-navy-900/10 py-3 font-bold text-navy-800 hover:border-amber-500 hover:bg-amber-50"
                  >
                    {a.label}
                    <div className="text-xs font-normal text-fog-500">
                      ≈ {a.ml} mL
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 items-end">
              <label className="flex-1 text-sm font-semibold text-navy-700">
                Exact amount (mL)
                <input
                  inputMode="decimal"
                  value={customMl}
                  onChange={(e) => setCustomMl(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-3 text-lg font-bold"
                />
              </label>
              <Button
                disabled={!customMl}
                onClick={() =>
                  log({ amountMl: parseFloat(customMl), status: "measured" })
                }
              >
                Save
              </Button>
            </div>
          </div>
        )}

        {kind === "output" && category === "urine" && (
          <div className="space-y-4">
            <div className="flex gap-2 items-end">
              <label className="flex-1 text-sm font-semibold text-navy-700">
                Measured volume (mL)
                <input
                  inputMode="decimal"
                  value={customMl}
                  onChange={(e) => setCustomMl(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-3 text-lg font-bold"
                />
              </label>
              <Button
                variant="output"
                disabled={!customMl}
                onClick={() =>
                  log({ amountMl: parseFloat(customMl), status: "measured" })
                }
              >
                Save
              </Button>
            </div>
            <ChipGrid
              options={UNMEASURED_URINE_SUBTYPES}
              onPick={(v) => log({ status: "unmeasured", subtype: v })}
            />
          </div>
        )}
        {kind === "output" && category === "continence" && (
          <ChipGrid
            options={CONTINENCE_SUBTYPES}
            onPick={(v) => log({ status: "unmeasured", subtype: v })}
          />
        )}
        {kind === "output" && category === "vomit" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {OUTPUT_QUICK_AMOUNTS.slice(0, 3).map((a) => (
                <button
                  key={a}
                  onClick={() => log({ amountMl: a, status: "measured" })}
                  className="rounded-2xl bg-white border border-navy-900/10 py-3 font-bold text-navy-800"
                >
                  {a} mL
                </button>
              ))}
            </div>
            <ChipGrid
              options={VOMIT_QUALITATIVE}
              onPick={(v) => log({ status: "unmeasured", subtype: v })}
            />
          </div>
        )}
        {kind === "output" && category === "diarrhoea" && (
          <ChipGrid
            options={DIARRHOEA_QUALITATIVE.map((d) => ({
              value: d.value,
              label: `Watery, ${d.label.toLowerCase()}`,
            }))}
            onPick={(v) =>
              log({
                status: "unmeasured",
                subtype: `watery_${v}`,
                episodeCount: 1,
              } as never)
            }
          />
        )}
        {kind === "output" &&
          (category === "stoma" ||
            category === "drain" ||
            category === "nasogastric") && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {OUTPUT_QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => log({ amountMl: a, status: "measured" })}
                    className="rounded-2xl bg-white border border-navy-900/10 py-3 font-bold text-navy-800"
                  >
                    {a} mL
                  </button>
                ))}
              </div>
              <Button
                fullWidth
                variant="secondary"
                onClick={() => log({ status: "unmeasured" })}
              >
                Unmeasured event
              </Button>
            </div>
          )}
        {kind === "output" && category === "sweating" && (
          <ChipGrid
            options={SWEATING_LEVELS}
            onPick={(v) => log({ status: "unmeasured", subtype: v })}
          />
        )}
        {kind === "output" && category === "other_output" && (
          <div className="space-y-4">
            <div className="flex gap-2 items-end">
              <label className="flex-1 text-sm font-semibold text-navy-700">
                Volume (mL)
                <input
                  inputMode="decimal"
                  value={customMl}
                  onChange={(e) => setCustomMl(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-3 text-lg font-bold"
                />
              </label>
              <Button
                variant="output"
                disabled={!customMl}
                onClick={() =>
                  log({ amountMl: parseFloat(customMl), status: "measured" })
                }
              >
                Save
              </Button>
            </div>
            <Button
              fullWidth
              variant="secondary"
              onClick={() => log({ status: "unmeasured" })}
            >
              Unmeasured event
            </Button>
          </div>
        )}
        {kind === "intake" && category === "other_intake" && null}
      </div>
    </div>
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
