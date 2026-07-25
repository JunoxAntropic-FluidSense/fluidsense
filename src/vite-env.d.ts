/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "false" to disable the "Explore demo" entry point and demo mode entirely in production. Defaults to enabled. */
  readonly VITE_ENABLE_DEMO_MODE?: string;
  /** Supabase project URL. Safe to expose in the frontend — protected by row-level security. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon/public key. Safe to expose in the frontend — protected by row-level security. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** VAPID public key for browser push subscriptions (check-in reminders). Safe to expose in the frontend — the matching private key is a server-only Supabase secret. */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
