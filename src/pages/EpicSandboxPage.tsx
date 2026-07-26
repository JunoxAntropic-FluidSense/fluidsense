// Read-only view of Epic sandbox clinical context for a fixed test patient
// (Camila Lopez, Epic's public open-sandbox synthetic patient — see
// src/lib/epic/types.ts for why this stays separate from the app's own
// FluidEvent/PatientProfile records rather than being merged in).
//
// Nothing here writes back to Epic or auto-imports into a FluidSense
// patient — it's a inspection view only.

import { useEpicData } from "../hooks/useEpicData";
import { Card, CardHeading } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

// Epic's own public open-sandbox synthetic patient used in every SMART
// tutorial — not a real person's record (see CLAUDE.md hard rule 3).
const CAMILA_LOPEZ_PATIENT_ID = "erXuFYUfucBZaryVksYEcMg3";

function Row({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-fog-100 last:border-0">
      <span className="text-sm text-fog-600">{label}</span>
      <span className="text-sm font-semibold text-navy-800">{value}</span>
    </div>
  );
}

export function EpicSandboxPage() {
  const { status, data, errorMessage, reload, configured } = useEpicData(
    CAMILA_LOPEZ_PATIENT_ID
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">
            Epic sandbox data
          </h1>
          <p className="text-sm text-fog-600">
            Read-only clinical context for Epic's public test patient (Camila
            Lopez). Nothing here is saved or merged into your own patient
            records.
          </p>
        </div>
        <Button variant="secondary" size="md" onClick={() => reload()}>
          Reload
        </Button>
      </div>

      {!configured && (
        <Card className="p-5 bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">
            Epic integration isn't configured (Supabase isn't set up).
          </p>
        </Card>
      )}

      {status === "loading" && (
        <Card className="p-5 text-center text-sm text-fog-600">
          Loading from Epic…
        </Card>
      )}

      {status === "error" && (
        <Card className="p-5 bg-amber-50 border border-amber-200">
          <p className="text-sm font-semibold text-amber-800">
            Could not load Epic data.
          </p>
          <p className="text-xs text-amber-700 mt-1">{errorMessage}</p>
        </Card>
      )}

      {data && (
        <>
          <Card className="p-5">
            <CardHeading>Demographics</CardHeading>
            <Row label="Name" value={data.patient?.name} />
            <Row label="Date of birth" value={data.patient?.birthDate} />
            <Row label="Sex" value={data.patient?.sex} />
            {data.patient?.identifiers.slice(0, 3).map((id, i) => (
              <Row key={i} label={id.system || "Identifier"} value={id.value} />
            ))}
          </Card>

          <Card className="p-5">
            <CardHeading>Current encounter</CardHeading>
            {data.encounter ? (
              <>
                <Row label="Status" value={data.encounter.status} />
                <Row label="Ward" value={data.encounter.ward} />
                <Row label="Admitted" value={data.encounter.admittedAt} />
              </>
            ) : (
              <p className="text-sm text-fog-500">
                No active encounter on file.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <CardHeading>
              Conditions on file ({data.conditions.length})
            </CardHeading>
            {data.conditions.length === 0 ? (
              <p className="text-sm text-fog-500">None recorded.</p>
            ) : (
              data.conditions.map((c) => (
                <Row key={c.id} label={c.label} value={c.clinicalStatus} />
              ))
            )}
          </Card>

          <Card className="p-5">
            <CardHeading>Observations (weight / vitals / labs)</CardHeading>
            <Row
              label="Weight"
              value={
                data.observations.weightKg
                  ? `${data.observations.weightKg.value} ${data.observations.weightKg.unit ?? ""}`
                  : undefined
              }
            />
            <Row
              label="Blood pressure"
              value={
                data.observations.bloodPressure
                  ? `${data.observations.bloodPressure.systolic}/${data.observations.bloodPressure.diastolic}`
                  : undefined
              }
            />
            <Row
              label="Heart rate"
              value={
                data.observations.heartRate
                  ? `${data.observations.heartRate.value} ${data.observations.heartRate.unit ?? ""}`
                  : undefined
              }
            />
            <Row
              label="Creatinine"
              value={
                data.observations.creatinine
                  ? `${data.observations.creatinine.value} ${data.observations.creatinine.unit ?? ""}`
                  : undefined
              }
            />
            <Row
              label="Urea"
              value={
                data.observations.urea
                  ? `${data.observations.urea.value} ${data.observations.urea.unit ?? ""}`
                  : undefined
              }
            />
            <Row
              label="Sodium"
              value={
                data.observations.sodium
                  ? `${data.observations.sodium.value} ${data.observations.sodium.unit ?? ""}`
                  : undefined
              }
            />
            <Row
              label="Potassium"
              value={
                data.observations.potassium
                  ? `${data.observations.potassium.value} ${data.observations.potassium.unit ?? ""}`
                  : undefined
              }
            />
            <Row
              label="eGFR"
              value={
                data.observations.egfr
                  ? `${data.observations.egfr.value} ${data.observations.egfr.unit ?? ""}`
                  : undefined
              }
            />
            {Object.keys(data.observations).length === 0 && (
              <p className="text-sm text-fog-500">
                No observations available yet.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <CardHeading>
              Medications on file ({data.medicationOrders.length})
            </CardHeading>
            {data.medicationOrders.length === 0 ? (
              <p className="text-sm text-fog-500">None recorded.</p>
            ) : (
              data.medicationOrders.map((m) => (
                <Row
                  key={m.id}
                  label={m.label + (m.isDiureticLike ? " (diuretic)" : "")}
                  value={m.status}
                />
              ))
            )}
          </Card>

          <Card className="p-5">
            <CardHeading>
              Nutrition orders ({data.nutritionOrders.length})
            </CardHeading>
            {data.nutritionOrders.length === 0 ? (
              <p className="text-sm text-fog-500">None recorded.</p>
            ) : (
              data.nutritionOrders.map((n) => (
                <Row
                  key={n.id}
                  label={n.label}
                  value={n.fluidRestrictionText}
                />
              ))
            )}
          </Card>

          <p className="text-xs text-fog-500 text-center">
            Fetched {new Date(data.fetchedAt).toLocaleTimeString()}
          </p>
        </>
      )}
    </div>
  );
}
