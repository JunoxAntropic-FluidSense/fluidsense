// Fetches read-only clinical context for a given Epic patient id and adapts
// it into EpicPatientContext (see src/lib/epic/types.ts for why this stays
// a separate shape rather than being merged into the local FluidEvent store).
// Never writes anything back to Epic, never auto-imports into the app's own
// patient record — a page/component decides what, if anything, to display
// or let a clinician manually copy across.

import { useCallback, useEffect, useState } from "react";
import {
  fetchEpicResource,
  EPIC_PROXY_CONFIGURED,
} from "../lib/epic/epicClient";
import {
  adaptConditions,
  adaptEncounter,
  adaptMedicationOrders,
  adaptNutritionOrders,
  adaptObservations,
  adaptPatient,
} from "../lib/epic/adapter";
import type { EpicPatientContext } from "../lib/epic/types";

export type UseEpicDataStatus = "idle" | "loading" | "ready" | "error";

export function useEpicData(patientId: string | null) {
  const [status, setStatus] = useState<UseEpicDataStatus>("idle");
  const [data, setData] = useState<EpicPatientContext | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!patientId || !EPIC_PROXY_CONFIGURED) return;
    setStatus("loading");
    setErrorMessage(null);
    try {
      const [
        patientBundle,
        encounterBundle,
        conditionBundle,
        labObservations,
        vitalObservations,
        medicationBundle,
        nutritionBundle,
      ] = await Promise.all([
        fetchEpicResource("Patient", patientId),
        fetchEpicResource("Encounter", patientId),
        fetchEpicResource("Condition", patientId),
        fetchEpicResource("Observation", patientId, "category=laboratory"),
        fetchEpicResource("Observation", patientId, "category=vital-signs"),
        fetchEpicResource("MedicationRequest", patientId),
        fetchEpicResource("NutritionOrder", patientId),
      ]);

      const labObs = adaptObservations(labObservations);
      const vitalObs = adaptObservations(vitalObservations);

      setData({
        patient: adaptPatient(patientBundle),
        encounter: adaptEncounter(encounterBundle),
        conditions: adaptConditions(conditionBundle),
        observations: { ...vitalObs, ...labObs },
        medicationOrders: adaptMedicationOrders(medicationBundle),
        nutritionOrders: adaptNutritionOrders(nutritionBundle),
        fetchedAt: new Date().toISOString(),
      });
      setStatus("ready");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not load Epic data."
      );
      setStatus("error");
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    status,
    data,
    errorMessage,
    reload: load,
    configured: EPIC_PROXY_CONFIGURED,
  };
}
