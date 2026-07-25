// Landing page for magic-link / OAuth redirects. supabase-js's
// detectSessionInUrl only auto-completes the implicit flow (an
// `#access_token=...` hash fragment) — Supabase's default magic-link email
// template instead redirects here with `?token_hash=...&type=...` query
// params, which need an explicit exchange. completeAuthFromUrl handles that
// (and the `?code=...` PKCE case, and the plain-hash-fragment case) so this
// page works regardless of which one actually fired. It never renders any
// lasting UI of its own, and it never touches onboarding state — onboarding
// stays a separate, local-only concept (see RequireOnboarding).

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { completeAuthFromUrl } from "../../lib/supabase";
import { pullUserRow } from "../../lib/supabase/accountSync";
import { useAuthStore } from "../../store/useAuthStore";
import { useStore } from "../../store/useStore";
import { PrototypeBanner } from "../../components/ui/PrototypeBanner";

export function AuthCallbackPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    completeAuthFromUrl(window.location.href).then(async ({ session }) => {
      if (cancelled) return;
      setSession(session);
      if (session?.user) {
        await pullUserRow(session.user.id);
      }
      setSignedIn(session !== null);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [setSession]);

  if (!ready) {
    return (
      <div className="min-h-dvh flex flex-col bg-fog-50">
        <PrototypeBanner />
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-sm text-fog-600">Signing you in…</p>
        </div>
      </div>
    );
  }

  // Success: go straight to onboarding (or the app, if already done) —
  // never back through /welcome, which would otherwise show the generic
  // sign-in screen again and look like nothing happened. Failure: back to
  // /welcome so they can retry.
  if (signedIn) {
    const state = useStore.getState();
    const target = state.currentUser.onboardingCompleted
      ? state.mode === "healthcare"
        ? "/dashboard"
        : "/"
      : "/onboarding";
    return <Navigate to={target} replace />;
  }
  return <Navigate to="/welcome" replace />;
}
