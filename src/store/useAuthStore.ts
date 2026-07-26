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
  isProfileLoaded: boolean;
  setSession: (session: Session | null) => void;
  setProfileLoaded: (loaded: boolean) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  user: null,
  status: "loading",
  isProfileLoaded: false,
  setSession: (session) =>
    set((state) => {
      const newUser = session?.user ?? null;
      // useAuthBootstrap.ts calls setSession from two independent places on
      // load (getSession() and the onAuthStateChange subscription) — both
      // can fire for the *same* already-linked user. Resetting
      // isProfileLoaded to false on every call, unconditionally, meant the
      // second of those two calls could stomp it back to false right after
      // pullUserRow had already set it true — and since accountSync.ts's
      // own dedup guard (lastLinkedAuthUserId) sees the same user id and
      // skips calling pullUserRow again, nothing would ever flip it back,
      // leaving every gated page (OnboardingFlow, WelcomePage) rendering
      // null forever. Only reset it when the signed-in user actually
      // changes — a redundant re-set of the same user keeps whatever
      // load-state is already true.
      const sameUser = Boolean(newUser && state.user?.id === newUser.id);
      return {
        session,
        user: newUser,
        status: session ? "signed-in" : "signed-out",
        isProfileLoaded: session
          ? sameUser
            ? state.isProfileLoaded
            : false
          : true,
      };
    }),
  setProfileLoaded: (isProfileLoaded) => set({ isProfileLoaded }),
}));
