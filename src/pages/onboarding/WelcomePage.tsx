import { Link, Navigate, useNavigate } from "react-router-dom";
import { useStore, DEMO_MODE_ENABLED } from "../../store/useStore";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PrototypeBanner } from "../../components/ui/PrototypeBanner";

export function WelcomePage() {
  const navigate = useNavigate();
  const onboardingCompleted = useStore(
    (s) => s.currentUser.onboardingCompleted
  );
  const viewContext = useStore((s) => s.viewContext);
  const enterDemoMode = useStore((s) => s.enterDemoMode);

  if (onboardingCompleted || viewContext === "demo")
    return <Navigate to="/" replace />;

  return (
    <div className="min-h-dvh flex flex-col bg-fog-50">
      <PrototypeBanner />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-md mx-auto w-full gap-6 text-center">
        <div>
          <h1 className="text-3xl font-extrabold text-navy-900 tracking-tight">
            FluidSense
          </h1>
          <p className="mt-2 text-fog-600">
            Quick, voice-friendly fluid intake and output tracking.
          </p>
        </div>

        <Card className="p-5 text-left">
          <p className="text-sm text-navy-800">
            FluidSense records fluid events and summarises the information
            entered. It cannot measure fluids that were not recorded and does
            not determine a patient's true fluid status.
          </p>
        </Card>

        <div className="w-full space-y-3">
          <Button fullWidth size="xl" onClick={() => navigate("/onboarding")}>
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
        </div>
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
