import { Navigate } from "react-router-dom";
import { useStore } from "../../store/useStore";
import { AppShell } from "./AppShell";

export function RequireOnboarding() {
  const onboardingCompleted = useStore(
    (s) => s.currentUser.onboardingCompleted
  );
  const viewContext = useStore((s) => s.viewContext);

  if (!onboardingCompleted && viewContext === "live") {
    return <Navigate to="/welcome" replace />;
  }

  return <AppShell />;
}
