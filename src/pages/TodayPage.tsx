import { Navigate } from "react-router-dom";
import { useFluidData } from "../hooks/useFluidData";
import { useStore } from "../store/useStore";
import { BalanceCard } from "../components/today/BalanceCard";
import { AllowanceCard } from "../components/today/AllowanceCard";
import { QuickAddGrid } from "../components/today/QuickAddGrid";
import { ActivityTimeline } from "../components/today/ActivityTimeline";
import { TodayContextCard } from "../components/today/TodayContextCard";
import { EmptyToday } from "../components/today/EmptyToday";

export function TodayPage() {
  const { patient, balance, reliability, lastEvent, windowEvents, range } =
    useFluidData("monitoring_day");
  const allEvents = useStore((s) => s.events);
  const mode = useStore((s) => s.mode);

  // Healthcare accounts start with no patients — send them to the dashboard's
  // "add patient" flow instead of rendering a blank single-patient view.
  if (!patient) {
    return mode === "healthcare" ? <Navigate to="/dashboard" replace /> : null;
  }

  const hasAnyEvents = allEvents.some(
    (e) => !e.deleted && e.patientId === patient.id
  );

  return (
    <div className="space-y-4 max-w-lg md:max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">
          Hello, {patient.displayName}
        </h1>
        <p className="text-sm text-fog-600">{patient.careSetting}</p>
      </div>

      {hasAnyEvents ? (
        <BalanceCard
          balance={balance}
          reliability={reliability}
          lastEvent={lastEvent}
          periodLabel={range.label}
        />
      ) : (
        <EmptyToday />
      )}

      <QuickAddGrid patient={patient} />

      <div className="grid gap-4 md:grid-cols-2">
        {patient.allowance && (
          <AllowanceCard
            allowance={patient.allowance}
            recordedIntakeMl={balance.totalIntakeMl}
          />
        )}
        <TodayContextCard
          patient={patient}
          events={windowEvents}
          className={patient.allowance ? "" : "md:col-span-2"}
        />
      </div>

      {hasAnyEvents && <ActivityTimeline events={windowEvents} />}
    </div>
  );
}
