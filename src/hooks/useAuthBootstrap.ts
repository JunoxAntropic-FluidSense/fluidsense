// Feeds src/store/useAuthStore.ts from the Supabase session layer at app
// start. Follows the same shape as useOnlineStatus.ts: subscribe to an
// external source inside useEffect, return the unsubscribe function as
// cleanup. If Supabase isn't configured, getSession()/subscribeToAuthChanges
// already no-op cleanly (see src/lib/supabase/client.ts,session.ts) — the
// store simply settles on "signed-out" without this hook needing its own
// isSupabaseConfigured() branch.

import { useEffect } from "react";
import { getSession, subscribeToAuthChanges } from "../lib/supabase";
import { useAuthStore } from "../store/useAuthStore";

export function useAuthBootstrap() {
  useEffect(() => {
    const setSession = useAuthStore.getState().setSession;
    let cancelled = false;

    getSession().then(({ session }) => {
      if (!cancelled) {
        setSession(session);
      }
    });

    const unsubscribe = subscribeToAuthChanges((_event, session) => {
      setSession(session);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
}
