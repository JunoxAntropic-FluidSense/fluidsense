// Supabase client singleton. Backend is optional per CLAUDE.md — the app must
// run fully client-side without it, so this module must never throw when
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are absent. Mirrors the
// DEMO_MODE_ENABLED-style flag pattern in src/store/useStore.ts: a plain
// exported constant computed at module scope directly from import.meta.env,
// no class/singleton machinery beyond what's needed to avoid constructing a
// client with missing config.
//
// Only reads from import.meta.env.VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY —
// no hardcoded project refs, keys, or other credentials. The anon key is safe
// to ship to the client; it's protected by row-level security (see
// src/vite-env.d.ts).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );
}

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_ANON_KEY as string
    )
  : null;
