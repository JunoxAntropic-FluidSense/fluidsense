// Supabase Edge Function: turns a short confirmation phrase into spoken
// audio via ElevenLabs text-to-speech, so the provider key never touches the
// browser. Purely a nice-to-have voice-feedback layer on top of the existing
// tap-to-confirm flow (see transcribe/index.ts's sibling STT function) — it
// never saves anything itself and has no bearing on hard rule 4 (voice
// entries never save without explicit confirmation), since it only ever
// speaks back an entry that's already been confirmed by the user.
//
// Deploy with:  supabase functions deploy speak
// Configure with:
//   supabase secrets set ELEVENLABS_API_KEY=sk_...
//   supabase secrets set ELEVENLABS_VOICE_ID=...   (optional, defaults below)

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
// "Rachel" — a stock ElevenLabs premade voice, used only as a sane default
// so this works out of the box without requiring a voice library lookup.
const ELEVENLABS_VOICE_ID =
  Deno.env.get("ELEVENLABS_VOICE_ID") ?? "21m00Tcm4TlvDq8ikWAM";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Keeps the endpoint honest as "brief spoken confirmation," not a general
// text-to-speech relay — also bounds ElevenLabs cost per call.
const MAX_TEXT_LENGTH = 300;

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

  if (!ELEVENLABS_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "Voice feedback is not configured on the server.",
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { text } = await req.json();
    if (typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "No text provided." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.slice(0, MAX_TEXT_LENGTH),
          model_id: "eleven_turbo_v2_5",
        }),
      }
    );

    if (!upstream.ok) {
      const detail = await upstream.text();
      return new Response(
        JSON.stringify({ error: "Voice provider error.", detail }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
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
