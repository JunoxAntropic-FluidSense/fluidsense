// Public, unauthenticated JWKS endpoint for Epic's Backend Services app
// registration ("Non-Production JWK Set URL"). Serves only the PUBLIC key —
// there is nothing secret in this file, deliberately: Epic fetches this URL
// itself to verify the client_assertion JWT signed server-side in
// epic-fhir-proxy/index.ts (which holds the matching private key via the
// EPIC_PRIVATE_KEY secret, never exposed here or anywhere else).
//
// Deploy with:  supabase functions deploy epic-jwks --no-verify-jwt
//
// The "kid" here MUST match the "kid" epic-fhir-proxy puts in its JWT header
// — that's how Epic knows which key in this set to check the signature
// against.

const JWKS = {
  keys: [
    {
      kty: "RSA",
      n: "j6T1FO7DIZPfWbauYh7fnn0IIBu0eEgmMz3_iKbOg9v_8WMfS9av3TTyiz527pl05A6xSODXE5drCQoKJyAMK2F8HqeVLQudaBks6ChlWRno6y2sjYNcb18PpDmVFGAwhY_SyrSG6TEhrtNgLCWfhe8eR247JzZZpjR5Io49ZUo0VdpXnJbnakxC3CkRXSWqxgKsjFe_87kISzgC3zCyAwPeKRhPHBxE6wiW0LeCtb036z1yMkqPCmI7ZBPMPg2y9nKDOXShED3wy7BAGDU57hss5SkcGZiguHMoAmI5AheIz0QpiJDl_Q0QQmCcig6jSwD7KZaRjaE6rskInrjXiw",
      e: "AQAB",
      use: "sig",
      alg: "RS384",
      kid: "epic-key-1",
    },
  ],
};

Deno.serve((req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }
  return new Response(JSON.stringify(JWKS), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
