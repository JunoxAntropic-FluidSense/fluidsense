import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./useAuthStore";
import type { Session, User } from "@supabase/supabase-js";

function fakeSession(userId: string): Session {
  const user = { id: userId } as User;
  return { user } as Session;
}

describe("useAuthStore.setSession", () => {
  beforeEach(() => {
    useAuthStore.setState({
      session: null,
      user: null,
      status: "loading",
      isProfileLoaded: false,
    });
  });

  it("resets isProfileLoaded to false on a genuinely new sign-in", () => {
    useAuthStore.getState().setSession(fakeSession("user-a"));
    expect(useAuthStore.getState().isProfileLoaded).toBe(false);
  });

  it(
    "does NOT reset isProfileLoaded once true, on a redundant setSession " +
      "call for the same already-linked user — useAuthBootstrap.ts calls " +
      "setSession from two independent places (getSession() and the " +
      "onAuthStateChange subscription) on load, and a second call landing " +
      "after pullUserRow already finished must never stomp it back to " +
      "false (accountSync.ts's dedup guard would then never call " +
      "pullUserRow again, leaving every gated page waiting forever).",
    () => {
      useAuthStore.getState().setSession(fakeSession("user-a"));
      useAuthStore.getState().setProfileLoaded(true);

      // Redundant second call for the same user (e.g. the other of the two
      // useAuthBootstrap call sites firing after the first already settled).
      useAuthStore.getState().setSession(fakeSession("user-a"));

      expect(useAuthStore.getState().isProfileLoaded).toBe(true);
    }
  );

  it("resets isProfileLoaded to false when a different user signs in", () => {
    useAuthStore.getState().setSession(fakeSession("user-a"));
    useAuthStore.getState().setProfileLoaded(true);

    useAuthStore.getState().setSession(fakeSession("user-b"));

    expect(useAuthStore.getState().isProfileLoaded).toBe(false);
  });

  it("marks the profile as loaded when signing out", () => {
    useAuthStore.getState().setSession(fakeSession("user-a"));
    useAuthStore.getState().setSession(null);

    expect(useAuthStore.getState().isProfileLoaded).toBe(true);
    expect(useAuthStore.getState().status).toBe("signed-out");
  });
});
