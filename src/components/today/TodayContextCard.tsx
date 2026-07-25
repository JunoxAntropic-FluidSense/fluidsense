import { Card, CardHeading } from "../ui/Card";
import { ReminderBanner } from "./ReminderBanner";
import { CheckInStatusList } from "./CheckInCard";
import { WeatherNote } from "./WeatherNote";
import type { FluidEvent, PatientProfile } from "../../types";

/**
 * Groups reminders, the weather note, and check-in status into one card so
 * they read as "things worth your attention right now" instead of three
 * separate full-width banners stacked above the balance card.
 */
export function TodayContextCard({
  patient,
  events,
  className = "",
}: {
  patient: PatientProfile;
  events: FluidEvent[];
  className?: string;
}) {
  return (
    <Card className={`p-5 space-y-3 ${className}`}>
      <CardHeading>Today</CardHeading>
      <ReminderBanner patient={patient} events={events} />
      <WeatherNote />
      <CheckInStatusList />
    </Card>
  );
}
