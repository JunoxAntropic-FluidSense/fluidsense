// Client for the "speak" Edge Function (see supabase/functions/speak/) —
// spoken confirmation feedback after a voice entry is saved. Best-effort and
// silent on failure, same convention as accountSync.ts's server syncs: this
// is a nice-to-have voice layer, never a blocking step, and must never
// surface an error or delay the save it's confirming (that already happened
// by the time this runs).

export const SERVER_TTS_CONFIGURED = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

let currentAudio: HTMLAudioElement | null = null;

/** Speaks `text` aloud via ElevenLabs. Swallows all failures — see file header. */
export async function speakConfirmation(text: string): Promise<void> {
  if (!SERVER_TTS_CONFIGURED || !text.trim()) return;
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speak`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    // Only one confirmation should ever play at once — if a previous one is
    // still going (rapid consecutive entries), cut it off rather than
    // overlapping audio.
    currentAudio?.pause();
    const audio = new Audio(objectUrl);
    currentAudio = audio;
    audio.addEventListener("ended", () => URL.revokeObjectURL(objectUrl));
    await audio.play().catch(() => {
      // Autoplay can be blocked in some contexts — not worth surfacing,
      // the entry is already saved and visible either way.
      URL.revokeObjectURL(objectUrl);
    });
  } catch {
    // Best-effort only — swallow, see file header.
  }
}
