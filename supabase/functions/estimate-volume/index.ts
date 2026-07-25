// Supabase Edge Function: proxies a drink-container photo to a vision-capable
// chat-completion provider so the provider API key never touches the browser.
//
// Deploy with:  supabase functions deploy estimate-volume
// Configure the key with:  supabase secrets set OPENAI_API_KEY=sk-...
//
// The function never persists the uploaded image — it is read into memory,
// forwarded to the provider, and discarded once the response is returned.

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// System prompt: the closed JSON schema below (no free-text field) is the
// primary guard against diagnostic/clinical language leaking to the client —
// this wording is defense-in-depth only, per CLAUDE.md hard rule 2 ("No
// diagnostic or clinical-decision language, anywhere... the app reports what
// was recorded and how complete that record is, and never concludes on the
// user's behalf").
const SYSTEM_PROMPT =
  "You estimate the liquid volume visible in a photo of a drink container. " +
  "Respond only with the structured fields requested. Never include " +
  "diagnostic, clinical, or health-decision language of any kind (for " +
  "example: dehydration, AKI, fluid overload, or similar) — you are " +
  "describing what is visible in the image, not drawing any conclusion " +
  "about a person's health or care. Do not include any free-text " +
  "explanation, reasoning, or description outside the requested fields.";

const RESPONSE_JSON_SCHEMA = {
  name: "volume_estimate",
  strict: true,
  schema: {
    type: "object",
    properties: {
      estimatedMl: { type: "number" },
      visibleFillFraction: { type: "number" },
      containerGuess: { type: "string" },
    },
    required: ["estimatedMl", "visibleFillFraction", "containerGuess"],
    additionalProperties: false,
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "Volume estimation is not configured on the server.",
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const incomingForm = await req.formData();
    const image = incomingForm.get("image");
    if (!(image instanceof File)) {
      return new Response(
        JSON.stringify({ error: "No image file received." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const imageBytes = new Uint8Array(await image.arrayBuffer());
    let binary = "";
    for (let i = 0; i < imageBytes.length; i++) {
      binary += String.fromCharCode(imageBytes[i]);
    }
    const base64Image = btoa(binary);
    const mimeType = image.type || "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Estimate the liquid volume visible in this photo of a " +
                  "drink container.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: RESPONSE_JSON_SCHEMA,
        },
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return new Response(
        JSON.stringify({ error: "Volume estimation provider error.", detail }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await upstream.json();
    const content = result.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    // Re-serialize only the three allowed keys — never pass the provider's
    // raw response through, so no free-text field can reach the client
    // regardless of what the model actually returned.
    const estimatedMl = Number(parsed.estimatedMl);
    const body: {
      estimatedMl: number;
      visibleFillFraction?: number;
      containerGuess?: string;
    } = {
      estimatedMl: Number.isFinite(estimatedMl) ? estimatedMl : 0,
    };
    if (typeof parsed.visibleFillFraction === "number") {
      body.visibleFillFraction = parsed.visibleFillFraction;
    }
    if (typeof parsed.containerGuess === "string") {
      body.containerGuess = parsed.containerGuess;
    }

    return new Response(JSON.stringify(body), {
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
