// Supabase Edge Function: Epic FHIR backend-services (system-to-system, no
// user login) proxy. Holds the private key and does the JWT-assertion token
// exchange server-side — Epic credentials never touch the browser, same
// pattern as transcribe/estimate-volume/speak.
//
// Deploy with:  supabase functions deploy epic-fhir-proxy
// Configure with:
//   supabase secrets set EPIC_CLIENT_ID=<non-production client id>
//   supabase secrets set EPIC_PRIVATE_KEY="$(cat your-private-key.pem)"
//   supabase secrets set EPIC_FHIR_BASE=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
//   supabase secrets set EPIC_TOKEN_URL=https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token
//
// EPIC_PRIVATE_KEY is the PKCS8 PEM private key matching the public
// key/JWK you registered with Epic for this Backend Services app — Epic
// verifies the client_assertion JWT below against that public key, so this
// key is the actual credential and must never leave the server.
//
// Read-only: this function only ever performs GET requests against Epic and
// never writes anything back. It also never merges the fetched data into
// this app's own FluidEvent/store records — see src/lib/epic/adapter.ts for
// why that stays a separate "clinical context" shape rather than being
// silently folded into the user-entered audit trail.

import { create, getNumericDate } from "jsr:@zaubrik/djwt@3";

const EPIC_CLIENT_ID = Deno.env.get("EPIC_CLIENT_ID");
const EPIC_PRIVATE_KEY_PEM = Deno.env.get("EPIC_PRIVATE_KEY");
const EPIC_FHIR_BASE =
  Deno.env.get("EPIC_FHIR_BASE") ??
  "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4";
const EPIC_TOKEN_URL =
  Deno.env.get("EPIC_TOKEN_URL") ??
  "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Resource types this proxy is willing to fetch — an explicit allowlist so
// the `resource` query param can never be turned into an arbitrary-endpoint
// SSRF pivot against Epic's API.
const ALLOWED_RESOURCES = new Set([
  "Patient",
  "Encounter",
  "Condition",
  "Observation",
  "MedicationRequest",
  "NutritionOrder",
]);

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(): Promise<string> {
  if (!EPIC_CLIENT_ID || !EPIC_PRIVATE_KEY_PEM) {
    throw new Error("Epic integration is not configured on the server.");
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > now + 30_000) {
    return cachedToken.accessToken;
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(EPIC_PRIVATE_KEY_PEM),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" },
    // extractable:true so the diagnostic export below can run — the key
    // never leaves this function, only its PUBLIC modulus ("n", not
    // secret) gets logged, purely to compare against what's currently
    // served at /epic-jwks and confirm the two actually match.
    true,
    ["sign"]
  );

  try {
    const jwk = await crypto.subtle.exportKey("jwk", key);
    console.log("[epic-fhir-proxy] loaded EPIC_PRIVATE_KEY public n:", jwk.n);
  } catch (fingerprintErr) {
    console.log(
      "[epic-fhir-proxy] could not fingerprint key:",
      String(fingerprintErr)
    );
  }

  // Epic's backend-services JWT profile: iss/sub = client id, aud = token
  // endpoint, short expiry, unique jti per request. "kid" must match the key
  // entry in epic-jwks/index.ts's served JWKS, since that's the URL Epic
  // fetches to find the public key to verify this signature against.
  const assertion = await create(
    { alg: "RS384", typ: "JWT", kid: "epic-key-1" },
    {
      iss: EPIC_CLIENT_ID,
      sub: EPIC_CLIENT_ID,
      aud: EPIC_TOKEN_URL,
      jti: crypto.randomUUID(),
      exp: getNumericDate(60 * 4),
    },
    key
  );

  // Epic's Backend Services token request requires an explicit system-level
  // scope list — it must be a subset of whatever resource scopes were
  // actually granted to this app in Epic's registration (the scope
  // picker on the app-registration page). Omitting this entirely is a
  // separate bug from the granted-scopes registration step itself.
  const EPIC_SCOPES =
    Deno.env.get("EPIC_SCOPES") ??
    [
      "system/Patient.read",
      "system/Encounter.read",
      "system/Condition.read",
      "system/Observation.read",
      "system/MedicationRequest.read",
      "system/NutritionOrder.read",
    ].join(" ");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
    scope: EPIC_SCOPES,
  });

  console.log(
    "[epic-fhir-proxy] token request:",
    JSON.stringify({
      tokenUrl: EPIC_TOKEN_URL,
      clientId: EPIC_CLIENT_ID,
      scope: EPIC_SCOPES,
      jwtHeader: { alg: "RS384", typ: "JWT", kid: "epic-key-1" },
    })
  );

  const res = await fetch(EPIC_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.log("[epic-fhir-proxy] Epic token exchange failed:", errText);
    throw new Error(`Epic token exchange failed: ${errText}`);
  }

  const data = await res.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAtMs: now + (data.expires_in ?? 300) * 1000,
  };
  // Not secret — Epic echoes back the scope string it actually granted,
  // which can be a narrower set than what was requested. Stashed here so a
  // failing downstream FHIR call can report it for debugging.
  lastGrantedScope = typeof data.scope === "string" ? data.scope : null;
  return cachedToken.accessToken;
}

let lastGrantedScope: string | null = null;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");
  const patientId = url.searchParams.get("patientId");
  const query = url.searchParams.get("query") ?? "";

  if (!resource || !ALLOWED_RESOURCES.has(resource)) {
    return new Response(JSON.stringify({ error: "Unknown resource type." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!patientId) {
    return new Response(JSON.stringify({ error: "patientId is required." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const accessToken = await getAccessToken();

    // Patient is fetched by id directly; every other resource here is
    // patient-compartment search (?patient=<id>&...).
    const fhirPath =
      resource === "Patient"
        ? `/Patient/${encodeURIComponent(patientId)}`
        : `/${resource}?patient=${encodeURIComponent(patientId)}${query ? `&${query}` : ""}`;

    const upstream = await fetch(`${EPIC_FHIR_BASE}${fhirPath}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/fhir+json",
      },
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return new Response(
        JSON.stringify({
          error: "Epic FHIR error.",
          detail,
          status: upstream.status,
          grantedScope: lastGrantedScope,
          requestedPath: fhirPath,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Unexpected server error.",
        detail: String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
