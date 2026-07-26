// Supabase Edge Function: proxies audio to a speech-to-text provider so the
// provider API key never touches the browser.
//
// Deploy with:  supabase functions deploy transcribe
// Configure a key with ONE of:
//   supabase secrets set ELEVENLABS_API_KEY=sk_...   (preferred if both set)
//   supabase secrets set OPENAI_API_KEY=sk-...
//
// The function never persists the uploaded audio — it is read into memory,
// forwarded to the provider, and discarded once the response is returned.

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function transcribeWithElevenLabs(audio: File): Promise<string> {
  const upstreamForm = new FormData();
  upstreamForm.append("file", audio, "recording.webm");
  upstreamForm.append("model_id", "scribe_v1");

  const upstream = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY! },
    body: upstreamForm,
  });

  if (!upstream.ok) {
    throw new Error(await upstream.text());
  }
  const result = await upstream.json();
  return result.text ?? "";
}

async function transcribeWithOpenAI(audio: File): Promise<string> {
  const upstreamForm = new FormData();
  upstreamForm.append("file", audio, "recording.webm");
  upstreamForm.append("model", "gpt-4o-transcribe");
  upstreamForm.append("response_format", "json");

  const upstream = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: upstreamForm,
    }
  );

  if (!upstream.ok) {
    throw new Error(await upstream.text());
  }
  const result = await upstream.json();
  return result.text ?? "";
}

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

  if (!ELEVENLABS_API_KEY && !OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "Transcription provider is not configured on the server.",
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const incomingForm = await req.formData();
    const audio = incomingForm.get("audio");
    if (!(audio instanceof File)) {
      return new Response(
        JSON.stringify({ error: "No audio file received." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const transcript = ELEVENLABS_API_KEY
      ? await transcribeWithElevenLabs(audio)
      : await transcribeWithOpenAI(audio);

    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Transcription provider error.",
        detail: String(err),
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
