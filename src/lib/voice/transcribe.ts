// Server-side transcription client. Posts a recorded audio clip to a Supabase
// Edge Function (see supabase/functions/transcribe/), which holds the actual
// speech-to-text provider key server-side — never in frontend code. If no
// Supabase project is configured, this path is simply unavailable and the
// caller (useVoiceCapture) falls back to the browser's built-in recognition.

export const SERVER_STT_CONFIGURED = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

export class TranscriptionUnavailableError extends Error {}

export async function transcribeAudioServer(blob: Blob): Promise<string> {
  if (!SERVER_STT_CONFIGURED) {
    throw new TranscriptionUnavailableError(
      "Server transcription is not configured."
    );
  }
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`;
  const form = new FormData();
  form.append("audio", blob, "recording.webm");

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: form,
    });
  } catch {
    throw new TranscriptionUnavailableError(
      "Could not reach the transcription service."
    );
  }

  if (!res.ok) {
    throw new TranscriptionUnavailableError(
      `Transcription service returned an error (${res.status}).`
    );
  }
  const data = (await res.json()) as { transcript?: string };
  if (!data.transcript) {
    throw new Error("No speech was detected in the recording.");
  }
  return data.transcript;
}
