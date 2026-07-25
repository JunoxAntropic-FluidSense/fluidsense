// Thin wrappers over supabase-js v2 session reads/subscriptions. Kept
// deliberately simple and stable — issue #0002's useAuthStore and issue
// #0005's accountSync.ts are expected to consume these directly. Never throws
// when no backend is configured (see ./client.ts); resolves/calls back with
// an empty session instead.

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "./client";

export interface SessionResult {
  session: Session | null;
  error: { message: string } | null;
}

export async function getSession(): Promise<SessionResult> {
  if (!supabase) {
    return { session: null, error: null };
  }
  const { data, error } = await supabase.auth.getSession();
  return {
    session: data.session,
    error: error ? { message: error.message } : null,
  };
}

export type AuthChangeCallback = (
  event: AuthChangeEvent,
  session: Session | null
) => void;

/** Subscribes to auth state changes. Returns an unsubscribe function. */
export function subscribeToAuthChanges(cb: AuthChangeCallback): () => void {
  if (!supabase) {
    return () => {};
  }
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(cb);
  return () => subscription.unsubscribe();
}
