import { useState } from "react";
import { Bell } from "@phosphor-icons/react";
import { differenceInHours } from "date-fns";
import type { FluidEvent, PatientProfile } from "../../types";

export function ReminderBanner({
  patient,
  events,
}: {
  patient: PatientProfile;
  events: FluidEvent[];
}) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  const drinkReminder = patient.reminders.find(
    (r) => r.kind === "record_drink" && r.enabled
  );
  const outputReminder = patient.reminders.find(
    (r) => r.kind === "record_output" && r.enabled
  );

  const lastIntake = events.find((e) => e.direction === "intake");
  const lastOutput = events.find((e) => e.direction === "output");
  const now = new Date();

  const messages: { id: string; text: string }[] = [];

  if (drinkReminder) {
    const hours = drinkReminder.intervalHours ?? 4;
    const gap = lastIntake
      ? differenceInHours(now, new Date(lastIntake.eventTime))
      : hours + 1;
    if (gap >= hours) {
      messages.push({
        id: "drink",
        text: `No fluid intake has been recorded for ${gap} hours. Add an entry if anything was consumed.`,
      });
    }
  }
  if (outputReminder) {
    const hours = outputReminder.intervalHours ?? 4;
    const gap = lastOutput
      ? differenceInHours(now, new Date(lastOutput.eventTime))
      : hours + 1;
    if (gap >= hours) {
      messages.push({
        id: "output",
        text: `No output has been recorded for ${gap} hours. Add an entry if anything was passed.`,
      });
    }
  }

  const visible = messages.filter((m) => !dismissed.includes(m.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((m) => (
        <div
          key={m.id}
          role="status"
          className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3"
        >
          <Bell
            size={20}
            weight="fill"
            className="shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <p className="flex-1 text-sm text-amber-800">{m.text}</p>
          <button
            onClick={() => setDismissed((d) => [...d, m.id])}
            aria-label="Dismiss reminder"
            className="text-amber-700 font-bold text-lg min-h-8 min-w-8"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
