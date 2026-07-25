/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "false" to disable the "Explore demo" entry point and demo mode entirely in production. Defaults to enabled. */
  readonly VITE_ENABLE_DEMO_MODE?: string;
  /** Supabase project URL. Safe to expose in the frontend — protected by row-level security. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon/public key. Safe to expose in the frontend — protected by row-level security. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
