// Shapes this app's UI would consume from Epic — deliberately a separate
// "read-only clinical context" model, not merged into FluidEvent/PatientProfile.
// Reasons this stays separate rather than being written into the local store:
//   - FluidEvent's audit trail (enteredBy/inputMethod/editHistory) means
//     "something a person on this device recorded" — an EHR-sourced value
//     doesn't fit that model without inventing a new provenance concept
//     calc.ts/reliability.ts aren't built for (both are spec-critical files
//     per CLAUDE.md's testing requirement).
//   - Hard rule 2 (no diagnostic/clinical-decision language) applies just as
//     much to imported EHR data as to anything generated locally — Condition
//     names are shown verbatim as "on file", never interpreted.
//   - Hard rule 3 (no real PII) doesn't block this: Camila Lopez /
//     erXuFYUfucBZaryVksYEcMg3 is Epic's own public open-sandbox synthetic
//     test patient, not a real person's record.

export interface EpicPatientContext {
  patient: EpicDemographics | null;
  encounter: EpicEncounter | null;
  conditions: EpicCondition[];
  observations: EpicObservations;
  medicationOrders: EpicMedicationOrder[];
  nutritionOrders: EpicNutritionOrder[];
  fetchedAt: string;
}

export interface EpicDemographics {
  id: string;
  name: string;
  identifiers: { system: string; value: string }[];
  birthDate?: string;
  sex?: "male" | "female" | "other" | "unknown";
}

export interface EpicEncounter {
  id: string;
  status: string;
  ward?: string;
  admittedAt?: string;
}

export interface EpicCondition {
  id: string;
  label: string;
  clinicalStatus?: string;
  onsetDate?: string;
}

export interface EpicObservationPoint {
  value: number;
  unit?: string;
  observedAt?: string;
}

export interface EpicObservations {
  weightKg?: EpicObservationPoint;
  bloodPressure?: { systolic: number; diastolic: number; observedAt?: string };
  heartRate?: EpicObservationPoint;
  creatinine?: EpicObservationPoint;
  urea?: EpicObservationPoint;
  sodium?: EpicObservationPoint;
  potassium?: EpicObservationPoint;
  egfr?: EpicObservationPoint;
  priorUrineOutput?: EpicObservationPoint[];
}

export interface EpicMedicationOrder {
  id: string;
  label: string;
  status: string;
  intent?: string;
  authoredOn?: string;
  /** True for a diuretic-class order, detected by name match only — never a
   * clinical judgment, just lets the UI group "fluid-relevant" orders. */
  isDiureticLike: boolean;
}

export interface EpicNutritionOrder {
  id: string;
  label: string;
  status: string;
  /** Free-text fluid restriction/target as recorded on the order, if any —
   * shown verbatim, never computed or inferred by this app. */
  fluidRestrictionText?: string;
}
