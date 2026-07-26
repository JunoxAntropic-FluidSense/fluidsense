// Maps raw Epic FHIR R4 JSON into this app's EpicPatientContext shapes (see
// types.ts for why these stay separate from FluidEvent/PatientProfile).
// Every function here is a pure mapping, easy to unit test against fixture
// FHIR bundles — no network/store access in this file.

import type {
  EpicCondition,
  EpicDemographics,
  EpicEncounter,
  EpicMedicationOrder,
  EpicNutritionOrder,
  EpicObservationPoint,
  EpicObservations,
} from "./types";

// deno-lint-ignore no-explicit-any
type FhirResource = any;

const DIURETIC_NAME_PATTERN =
  /furosemide|bumetanide|torsemide|spironolactone|metolazone|thiazide|chlorthalidone/i;

const LOINC_CODE = {
  weight: "29463-7",
  systolicBp: "8480-6",
  diastolicBp: "8462-4",
  heartRate: "8867-4",
  creatinine: "2160-0",
  urea: "3094-0",
  sodium: "2951-2",
  potassium: "2823-3",
  egfr: "48642-3",
  urineOutput: "9187-6",
} as const;

function findCoding(resource: FhirResource, system?: string): string[] {
  const codings = resource?.code?.coding ?? [];
  return codings
    .filter((c: FhirResource) => !system || c.system === system)
    .map((c: FhirResource) => c.code)
    .filter(Boolean);
}

function hasLoinc(resource: FhirResource, code: string): boolean {
  return findCoding(resource, "http://loinc.org").includes(code);
}

function toPoint(resource: FhirResource): EpicObservationPoint | undefined {
  const value = resource?.valueQuantity?.value;
  if (typeof value !== "number") return undefined;
  return {
    value,
    unit: resource?.valueQuantity?.unit,
    observedAt: resource?.effectiveDateTime,
  };
}

export function adaptPatient(bundle: FhirResource): EpicDemographics | null {
  if (!bundle || bundle.resourceType !== "Patient") return null;
  const nameEntry = bundle.name?.[0];
  const name = nameEntry
    ? [nameEntry.given, nameEntry.family].flat().filter(Boolean).join(" ")
    : "Unknown";
  return {
    id: bundle.id,
    name,
    identifiers: (bundle.identifier ?? []).map((i: FhirResource) => ({
      system: i.system ?? "",
      value: i.value ?? "",
    })),
    birthDate: bundle.birthDate,
    sex: bundle.gender,
  };
}

export function adaptEncounter(bundle: FhirResource): EpicEncounter | null {
  const entry = bundle?.entry?.[0]?.resource;
  if (!entry) return null;
  const wardLocation = entry.location?.find(
    (l: FhirResource) => l.status === "active"
  )?.location?.display;
  return {
    id: entry.id,
    status: entry.status,
    ward: wardLocation,
    admittedAt: entry.period?.start,
  };
}

export function adaptConditions(bundle: FhirResource): EpicCondition[] {
  const entries = bundle?.entry ?? [];
  return entries.map(({ resource }: FhirResource) => ({
    id: resource.id,
    label:
      resource.code?.text ?? resource.code?.coding?.[0]?.display ?? "Unknown",
    clinicalStatus: resource.clinicalStatus?.coding?.[0]?.code,
    onsetDate: resource.onsetDateTime,
  }));
}

export function adaptObservations(bundle: FhirResource): EpicObservations {
  const resources = (bundle?.entry ?? []).map((e: FhirResource) => e.resource);
  const result: EpicObservations = {};

  for (const r of resources) {
    if (hasLoinc(r, LOINC_CODE.weight)) {
      const p = toPoint(r);
      if (p) result.weightKg = p;
    } else if (hasLoinc(r, LOINC_CODE.heartRate)) {
      const p = toPoint(r);
      if (p) result.heartRate = p;
    } else if (hasLoinc(r, LOINC_CODE.creatinine)) {
      const p = toPoint(r);
      if (p) result.creatinine = p;
    } else if (hasLoinc(r, LOINC_CODE.urea)) {
      const p = toPoint(r);
      if (p) result.urea = p;
    } else if (hasLoinc(r, LOINC_CODE.sodium)) {
      const p = toPoint(r);
      if (p) result.sodium = p;
    } else if (hasLoinc(r, LOINC_CODE.potassium)) {
      const p = toPoint(r);
      if (p) result.potassium = p;
    } else if (hasLoinc(r, LOINC_CODE.egfr)) {
      const p = toPoint(r);
      if (p) result.egfr = p;
    } else if (hasLoinc(r, LOINC_CODE.urineOutput)) {
      const p = toPoint(r);
      if (p) result.priorUrineOutput = [...(result.priorUrineOutput ?? []), p];
    } else if (r.component) {
      // Blood pressure is a panel observation with systolic/diastolic
      // components rather than its own top-level LOINC value.
      const systolic = r.component.find((c: FhirResource) =>
        findCoding(c, "http://loinc.org").includes(LOINC_CODE.systolicBp)
      )?.valueQuantity?.value;
      const diastolic = r.component.find((c: FhirResource) =>
        findCoding(c, "http://loinc.org").includes(LOINC_CODE.diastolicBp)
      )?.valueQuantity?.value;
      if (typeof systolic === "number" && typeof diastolic === "number") {
        result.bloodPressure = {
          systolic,
          diastolic,
          observedAt: r.effectiveDateTime,
        };
      }
    }
  }

  return result;
}

export function adaptMedicationOrders(
  bundle: FhirResource
): EpicMedicationOrder[] {
  const entries = bundle?.entry ?? [];
  return entries.map(({ resource }: FhirResource) => {
    const label =
      resource.medicationCodeableConcept?.text ??
      resource.medicationCodeableConcept?.coding?.[0]?.display ??
      "Unknown medication";
    return {
      id: resource.id,
      label,
      status: resource.status,
      intent: resource.intent,
      authoredOn: resource.authoredOn,
      isDiureticLike: DIURETIC_NAME_PATTERN.test(label),
    };
  });
}

export function adaptNutritionOrders(
  bundle: FhirResource
): EpicNutritionOrder[] {
  const entries = bundle?.entry ?? [];
  return entries.map(({ resource }: FhirResource) => ({
    id: resource.id,
    label: resource.oralDiet?.type?.[0]?.text ?? "Nutrition order",
    status: resource.status,
    fluidRestrictionText: resource.note?.[0]?.text,
  }));
}
