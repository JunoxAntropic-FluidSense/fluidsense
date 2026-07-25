// Thin wrapper so main.tsx can mount the auth bootstrap without calling a
// hook directly (main.tsx isn't a component). Renders children unchanged —
// it exists purely to run useAuthBootstrap() at the top of the tree.
//
// Also starts issue #0005's accountSync subscriptions here: accountSync.ts
// only defines its useAuthStore/useStore subscriptions when startAccountSync()
// is called, and this is the one place already responsible for wiring up
// auth-adjacent, subscription-based side effects at app start.

import { useEffect, type ReactNode } from "react";
import { useAuthBootstrap } from "../../hooks/useAuthBootstrap";
import { startAccountSync } from "./accountSync";
import { startPatientSync } from "./patientSync";

export function AuthBootstrap({ children }: { children: ReactNode }) {
  useAuthBootstrap();
  // Both are idempotent (guarded internally) and safely no-op until their
  // preconditions hold (signed in; healthcare account with a workspace,
  // respectively) — started unconditionally here, in an effect rather than
  // the render body, matching useAuthBootstrap's own pattern.
  useEffect(() => {
    startAccountSync();
    startPatientSync();
  }, []);
  return children;
}
