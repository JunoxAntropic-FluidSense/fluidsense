// Non-persisted auth session store. Deliberately separate from
// src/store/useStore.ts (app data, persisted to localStorage) — this holds
// only Supabase session state, and the Supabase SDK already persists its own
// session under its own localStorage key, so wrapping this in zustand's
// `persist` middleware would be redundant and could drift out of sync with
// the SDK's copy. Populated by src/hooks/useAuthBootstrap.ts at app start.

import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "signed-in" | "signed-out";

interface AuthState {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  user: null,
  status: "loading",
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      status: session ? "signed-in" : "signed-out",
    }),
}));
