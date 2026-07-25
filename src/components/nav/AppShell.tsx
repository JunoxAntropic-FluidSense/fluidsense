import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { PrototypeBanner } from "../ui/PrototypeBanner";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { ModeSwitcher } from "./ModeSwitcher";
import { PatientSwitcher } from "./PatientSwitcher";
import { useStore } from "../../store/useStore";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { needsMidnightRollover } from "../../lib/period";

const ROLLOVER_CHECK_INTERVAL_MS = 60_000;

export function AppShell() {
  const navigate = useNavigate();
  const mode = useStore((s) => s.mode);
  const viewContext = useStore((s) => s.viewContext);
  const exitDemoMode = useStore((s) => s.exitDemoMode);
  const accessibility = useStore((s) => s.currentUser.accessibility);
  const online = useOnlineStatus();

  useEffect(() => {
    document.documentElement.classList.toggle(
      "large-text",
      accessibility.largeText
    );
    document.documentElement.classList.toggle(
      "high-contrast",
      accessibility.highContrast
    );
    document.documentElement.classList.toggle(
      "reduce-motion",
      accessibility.reduceMotion
    );
  }, [accessibility]);

  // Patients on "midnight" mode (the default) get their MonitoringPeriod
  // record closed and reopened automatically as each calendar day turns
  // over, so the formal record stays in sync with the "Current monitoring
  // day" boundary already shown on Today/Summary — no manual "Start new
  // day" tap required. Runs once on mount (covers the app being reopened
  // after the app was closed overnight) and on an interval (covers the app
  // being left open through midnight).
  useEffect(() => {
    const checkRollover = () => {
      const state = useStore.getState();
      const now = new Date();
      for (const patient of state.patients) {
        if ((patient.monitoringDayStartMode ?? "midnight") !== "midnight")
          continue;
        const activePeriod = state.monitoringPeriods.find(
          (mp) => mp.profileId === patient.id && mp.status === "active"
        );
        if (
          activePeriod &&
          needsMidnightRollover(activePeriod.startTime, now)
        ) {
          state.startNewDay(patient.id);
        }
      }
    };
    checkRollover();
    const interval = setInterval(checkRollover, ROLLOVER_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-dvh flex flex-col bg-fog-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow"
      >
        Skip to main content
      </a>
      <PrototypeBanner />
      {!online && (
        <div
          className="bg-fog-700 text-white text-xs sm:text-sm text-center py-1.5 px-3"
          role="status"
        >
          You're offline. FluidSense keeps working with data already on this
          device — nothing will sync until you're back online.
        </div>
      )}
      {viewContext === "demo" && (
        <div className="bg-amber-100 text-amber-800 text-xs sm:text-sm text-center py-1.5 px-3 flex items-center justify-center gap-3">
          <span>Demo mode — fictional patients and data.</span>
          <button
            onClick={() => {
              exitDemoMode();
              navigate("/");
            }}
            className="underline font-semibold hover:no-underline"
          >
            Exit demo
          </button>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        {mode === "healthcare" && <Sidebar />}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-20 bg-fog-50/95 backdrop-blur border-b border-navy-900/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-navy-900 tracking-tight md:hidden">
                FluidSense
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <PatientSwitcher />
              {viewContext === "demo" && <ModeSwitcher />}
            </div>
          </header>
          <main
            id="main-content"
            className="flex-1 px-4 pt-4 pb-28 md:pb-10 max-w-3xl w-full mx-auto md:mx-0 md:max-w-none"
          >
            <Outlet />
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
