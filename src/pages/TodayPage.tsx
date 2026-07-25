import { Link } from "react-router-dom";
import { useFluidData } from "../hooks/useFluidData";
import { useStore } from "../store/useStore";
import { BalanceCard } from "../components/today/BalanceCard";
import { AllowanceCard } from "../components/today/AllowanceCard";
import { QuickAddGrid } from "../components/today/QuickAddGrid";
import { ActivityTimeline } from "../components/today/ActivityTimeline";
import { ReminderBanner } from "../components/today/ReminderBanner";
import { WeatherNote } from "../components/today/WeatherNote";
import { EmptyToday } from "../components/today/EmptyToday";
import { Button } from "../components/ui/Button";

export function TodayPage() {
  const { patient, balance, reliability, lastEvent, windowEvents, range } =
    useFluidData("monitoring_day");
  const allEvents = useStore((s) => s.events);

  if (!patient) return null;

  const hasAnyEvents = allEvents.some(
    (e) => !e.deleted && e.patientId === patient.id
  );

  return (
    <div className="space-y-4 max-w-lg mx-auto md:max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">
          Hello, {patient.displayName}
        </h1>
        <p className="text-sm text-fog-600">{patient.careSetting}</p>
      </div>

      <Link to="/voice">
        <Button
          fullWidth
          size="xl"
          icon={
            <span aria-hidden="true" className="text-2xl">
              🎙️
            </span>
          }
        >
          Speak an entry
        </Button>
      </Link>

      <ReminderBanner patient={patient} events={windowEvents} />
      <WeatherNote />

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

      {patient.allowance && (
        <AllowanceCard
          allowance={patient.allowance}
          recordedIntakeMl={balance.totalIntakeMl}
        />
      )}

      <QuickAddGrid patient={patient} />

      {hasAnyEvents && <ActivityTimeline events={windowEvents} />}
    </div>
  );
}
