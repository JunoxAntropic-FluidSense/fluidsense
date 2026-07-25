import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useStore, DEMO_MODE_ENABLED } from "../../store/useStore";
import { useAuthStore } from "../../store/useAuthStore";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PrototypeBanner } from "../../components/ui/PrototypeBanner";
import { EmailPasswordForm, MagicLinkForm } from "../../components/auth";

export function WelcomePage() {
  const navigate = useNavigate();
  const onboardingCompleted = useStore(
    (s) => s.currentUser.onboardingCompleted
  );
  const viewContext = useStore((s) => s.viewContext);
  const enterDemoMode = useStore((s) => s.enterDemoMode);
  const authStatus = useAuthStore((s) => s.status);
  // Account creation always comes first now — "Get started" opens the
  // sign-up panel directly, rather than sending people into onboarding
  // before they have an account. See OnboardingFlow.tsx, which no longer
  // has its own embedded sign-up step.
  const [authPanel, setAuthPanel] = useState<"sign-up" | "sign-in" | null>(
    null
  );
  const [useMagicLink, setUseMagicLink] = useState(false);

  if (viewContext === "demo") return <Navigate to="/" replace />;
  // Still resolving the session — avoid flashing the landing screen before
  // we know whether to redirect straight past it.
  if (authStatus === "loading") return null;
  // Signed in already: never show the landing/sign-in screen again — send
  // them straight into onboarding (or the app, if that's done too).
  if (authStatus === "signed-in") {
    return <Navigate to={onboardingCompleted ? "/" : "/onboarding"} replace />;
  }

  return (
    <div className="min-h-dvh flex flex-col bg-fog-50">
      <PrototypeBanner />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-md mx-auto w-full gap-6 text-center">
        <div>
          <h1 className="text-3xl font-extrabold text-navy-900 tracking-tight">
            FluidSense
          </h1>
          <p className="mt-2 text-fog-600">
            Quick, <em className="accent">voice-friendly</em> fluid intake and
            output tracking.
          </p>
        </div>

        <Card className="p-5 text-left">
          <p className="text-sm text-navy-800">
            FluidSense records fluid events and summarises the information
            entered. It cannot measure fluids that were not recorded and does
            not determine a patient's true fluid status.
          </p>
        </Card>

        {!authPanel && (
          <div className="w-full space-y-3">
            <Button fullWidth size="xl" onClick={() => setAuthPanel("sign-up")}>
              Get started
            </Button>
            {DEMO_MODE_ENABLED && (
              <Button
                fullWidth
                size="lg"
                variant="secondary"
                onClick={() => {
                  enterDemoMode();
                  navigate("/");
                }}
              >
                Explore demo
              </Button>
            )}
            <button
              type="button"
              onClick={() => setAuthPanel("sign-in")}
              className="text-sm text-fog-600 underline hover:no-underline"
            >
              Already have an account? Sign in
            </button>
          </div>
        )}

        {authPanel && (
          <Card className="w-full p-5 text-left space-y-3">
            <p className="text-xs text-fog-500">
              {authPanel === "sign-up"
                ? "Create an account to get started."
                : "Sign in to your account."}
            </p>
            {useMagicLink ? (
              <MagicLinkForm
                redirectTo={`${window.location.origin}/auth/callback`}
              />
            ) : (
              <EmailPasswordForm
                mode={authPanel}
                onSuccess={() =>
                  navigate(onboardingCompleted ? "/" : "/onboarding")
                }
              />
            )}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setUseMagicLink((v) => !v)}
                className="text-xs text-fog-500 underline hover:no-underline"
              >
                {useMagicLink
                  ? "Use a password instead"
                  : "Use a magic link instead"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setAuthPanel(authPanel === "sign-up" ? "sign-in" : "sign-up")
                }
                className="text-xs text-fog-500 underline hover:no-underline"
              >
                {authPanel === "sign-up"
                  ? "Sign in instead"
                  : "Sign up instead"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setAuthPanel(null)}
              className="text-xs text-fog-500 underline hover:no-underline"
            >
              Back
            </button>
          </Card>
        )}
        {DEMO_MODE_ENABLED && (
          <p className="text-xs text-fog-500">
            Demo mode uses fictional patients and fictional data. It never mixes
            with your own account.
          </p>
        )}
        <p className="text-xs text-fog-400">
          <Link to="/privacy" className="underline hover:no-underline">
            Privacy
          </Link>
          {" · "}
          <Link to="/terms" className="underline hover:no-underline">
            Terms
          </Link>
        </p>
      </div>
    </div>
  );
}
