// Morning / afternoon / evening check-in windows.
//
// Purely a completeness nudge — "has anything been logged in this window
// yet" — never a judgement about the patient. Pure functions only, no
// store/Supabase imports, so this stays as easily unit-testable as
// calc.ts/period.ts.

import { isSameDay } from "date-fns";
import type { FluidEvent } from "../types";

export type CheckInWindow = "morning" | "afternoon" | "evening";

export interface CheckInWindowDef {
  window: CheckInWindow;
  label: string;
  startHour: number; // inclusive, local time
  endHour: number; // exclusive, local time
}

// Local time, per day. 22:00-05:00 is intentionally uncovered — no
// reminder overnight. Boundaries must match the parallel server-side task.
export const CHECKIN_WINDOWS: CheckInWindowDef[] = [
  { window: "morning", label: "Morning", startHour: 5, endHour: 12 },
  { window: "afternoon", label: "Afternoon", startHour: 12, endHour: 17 },
  { window: "evening", label: "Evening", startHour: 17, endHour: 22 },
];

export type CheckInStatus = "done" | "missed" | "current" | "upcoming";

export interface CheckInWindowStatus {
  window: CheckInWindow;
  label: string;
  status: CheckInStatus;
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** The window `date` currently falls in, or null during the overnight gap. */
export function getCurrentCheckInWindow(date: Date): CheckInWindow | null {
  const minutes = minutesOfDay(date);
  const def = CHECKIN_WINDOWS.find(
    (w) => minutes >= w.startHour * 60 && minutes < w.endHour * 60
  );
  return def?.window ?? null;
}

function isEventInWindow(
  event: FluidEvent,
  def: CheckInWindowDef,
  referenceDate: Date
): boolean {
  const eventTime = new Date(event.eventTime);
  if (!isSameDay(eventTime, referenceDate)) return false;
  const minutes = minutesOfDay(eventTime);
  return minutes >= def.startHour * 60 && minutes < def.endHour * 60;
}

/**
 * Per-window status for the calendar day containing `referenceDate`.
 *
 * `events` should already be scoped to the relevant patient (any direction,
 * category, or measurement status counts — including `unmeasured` — since
 * this tracks "did someone check in," not "was it measured").
 */
export function getCheckInStatuses(
  events: FluidEvent[],
  referenceDate: Date
): CheckInWindowStatus[] {
  const currentWindow = getCurrentCheckInWindow(referenceDate);
  const nowMinutes = minutesOfDay(referenceDate);
  const active = events.filter((e) => !e.deleted);

  return CHECKIN_WINDOWS.map((def) => {
    const hasEntry = active.some((e) => isEventInWindow(e, def, referenceDate));

    let status: CheckInStatus;
    if (hasEntry) {
      status = "done";
    } else if (nowMinutes >= def.endHour * 60) {
      status = "missed";
    } else if (def.window === currentWindow) {
      status = "current";
    } else {
      status = "upcoming";
    }

    return { window: def.window, label: def.label, status };
  });
}
