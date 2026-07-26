// Client for the epic-fhir-proxy Edge Function — never talks to Epic
// directly and never sees any Epic credential. Mirrors transcribe.ts's
// "server does the real work, client just calls our own function" shape.

export const EPIC_PROXY_CONFIGURED = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

type EpicResourceType =
  | "Patient"
  | "Encounter"
  | "Condition"
  | "Observation"
  | "MedicationRequest"
  | "NutritionOrder";

export class EpicFetchError extends Error {}

export async function fetchEpicResource(
  resource: EpicResourceType,
  patientId: string,
  query?: string
  // deno-lint-ignore no-explicit-any
): Promise<any> {
  if (!EPIC_PROXY_CONFIGURED) {
    throw new EpicFetchError("Epic integration is not configured.");
  }
  const params = new URLSearchParams({ resource, patientId });
  if (query) params.set("query", query);

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/epic-fhir-proxy?${params}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    });
  } catch {
    throw new EpicFetchError("Could not reach the Epic integration service.");
  }

  if (!res.ok) {
    throw new EpicFetchError(
      `Epic integration returned an error (${res.status}).`
    );
  }
  return res.json();
}
