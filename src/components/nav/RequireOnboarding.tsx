import { Navigate } from "react-router-dom";
import { useStore } from "../../store/useStore";
import { useAuthStore } from "../../store/useAuthStore";
import { AppShell } from "./AppShell";

export function RequireOnboarding() {
  const onboardingCompleted = useStore(
    (s) => s.currentUser.onboardingCompleted
  );
  const viewContext = useStore((s) => s.viewContext);
  const authStatus = useAuthStore((s) => s.status);

  // Demo mode stays fully local and never requires an account.
  if (viewContext === "live") {
    // Auth session is still resolving (getSession() hasn't returned yet) —
    // render nothing rather than flash a sign-in redirect that immediately
    // reverses once the session is confirmed.
    if (authStatus === "loading") {
      return null;
    }
    if (
      authStatus === "signed-in" &&
      !useAuthStore.getState().isProfileLoaded
    ) {
      return null;
    }
    if (!onboardingCompleted) {
      return <Navigate to="/landing" replace />;
    }
    if (authStatus !== "signed-in") {
      return <Navigate to="/landing" replace />;
    }
  }

  return <AppShell />;
}
