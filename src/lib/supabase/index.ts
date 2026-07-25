// Barrel export for the Supabase client + auth adapter layer.

export { supabase, isSupabaseConfigured } from "./client";

export {
  signUpWithPassword,
  signInWithPassword,
  signInWithMagicLink,
  completeAuthFromUrl,
  signOut,
} from "./auth";
export type {
  NormalizedAuthError,
  AuthResult,
  AuthSessionResult,
} from "./auth";

export { getSession, subscribeToAuthChanges } from "./session";
export type { SessionResult, AuthChangeCallback } from "./session";

export { startAccountSync, stopAccountSync } from "./accountSync";
