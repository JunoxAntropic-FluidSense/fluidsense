import { describe, it, expect } from "vitest";
import {
  getCurrentCheckInWindow,
  getCheckInStatuses,
  CHECKIN_WINDOWS,
} from "./checkins";
import type { FluidEvent } from "../types";

function ev(partial: Partial<FluidEvent>): FluidEvent {
  return {
    id: Math.random().toString(),
    patientId: "p1",
    direction: "intake",
    category: "water",
    unit: "mL",
    status: "measured",
    eventTime: new Date().toISOString(),
    recordedTime: new Date().toISOString(),
    enteredBy: "Test",
    inputMethod: "manual",
    ...partial,
  };
}

describe("CHECKIN_WINDOWS", () => {
  it("defines morning/afternoon/evening with the agreed boundaries", () => {
    expect(CHECKIN_WINDOWS).toEqual([
      { window: "morning", label: "Morning", startHour: 5, endHour: 12 },
      { window: "afternoon", label: "Afternoon", startHour: 12, endHour: 17 },
      { window: "evening", label: "Evening", startHour: 17, endHour: 22 },
    ]);
  });
});

describe("getCurrentCheckInWindow", () => {
  it("returns null before 05:00", () => {
    expect(getCurrentCheckInWindow(new Date("2026-07-25T04:59:00"))).toBeNull();
  });

  it("returns morning at exactly 05:00 (inclusive start)", () => {
    expect(getCurrentCheckInWindow(new Date("2026-07-25T05:00:00"))).toBe(
      "morning"
    );
  });

  it("returns morning just before 12:00 and afternoon at exactly 12:00 (exclusive end)", () => {
    expect(getCurrentCheckInWindow(new Date("2026-07-25T11:59:00"))).toBe(
      "morning"
    );
    expect(getCurrentCheckInWindow(new Date("2026-07-25T12:00:00"))).toBe(
      "afternoon"
    );
  });

  it("returns afternoon just before 17:00 and evening at exactly 17:00", () => {
    expect(getCurrentCheckInWindow(new Date("2026-07-25T16:59:00"))).toBe(
      "afternoon"
    );
    expect(getCurrentCheckInWindow(new Date("2026-07-25T17:00:00"))).toBe(
      "evening"
    );
  });

  it("returns evening just before 22:00 and null at exactly 22:00 (overnight gap)", () => {
    expect(getCurrentCheckInWindow(new Date("2026-07-25T21:59:00"))).toBe(
      "evening"
    );
    expect(getCurrentCheckInWindow(new Date("2026-07-25T22:00:00"))).toBeNull();
  });

  it("returns null in the middle of the overnight gap", () => {
    expect(getCurrentCheckInWindow(new Date("2026-07-25T02:00:00"))).toBeNull();
  });
});

describe("getCheckInStatuses", () => {
  it("a day with no events at all: past windows missed, present window current, future windows upcoming", () => {
    const now = new Date("2026-07-25T13:00:00"); // in the afternoon window
    const statuses = getCheckInStatuses([], now);
    expect(statuses).toEqual([
      { window: "morning", label: "Morning", status: "missed" },
      { window: "afternoon", label: "Afternoon", status: "current" },
      { window: "evening", label: "Evening", status: "upcoming" },
    ]);
  });

  it("a day with events in only some windows: done where logged, missed/current/upcoming elsewhere", () => {
    const now = new Date("2026-07-25T18:00:00"); // in the evening window
    const events = [
      ev({ eventTime: new Date("2026-07-25T06:00:00").toISOString() }), // morning
    ];
    const statuses = getCheckInStatuses(events, now);
    expect(statuses.find((s) => s.window === "morning")?.status).toBe("done");
    expect(statuses.find((s) => s.window === "afternoon")?.status).toBe(
      "missed"
    );
    expect(statuses.find((s) => s.window === "evening")?.status).toBe(
      "current"
    );
  });

  it("marks a window done from any event — direction/category/status doesn't matter, including unmeasured", () => {
    const now = new Date("2026-07-25T13:00:00");
    const events = [
      ev({
        direction: "output",
        category: "urine",
        status: "unmeasured",
        eventTime: new Date("2026-07-25T06:30:00").toISOString(),
      }),
    ];
    const statuses = getCheckInStatuses(events, now);
    expect(statuses.find((s) => s.window === "morning")?.status).toBe("done");
  });

  it("does not count a deleted event as done", () => {
    const now = new Date("2026-07-25T13:00:00");
    const events = [
      ev({
        eventTime: new Date("2026-07-25T06:00:00").toISOString(),
        deleted: true,
      }),
    ];
    const statuses = getCheckInStatuses(events, now);
    expect(statuses.find((s) => s.window === "morning")?.status).toBe("missed");
  });

  it("ignores events from other calendar days", () => {
    const now = new Date("2026-07-25T13:00:00");
    const events = [
      ev({ eventTime: new Date("2026-07-24T06:00:00").toISOString() }), // yesterday morning
    ];
    const statuses = getCheckInStatuses(events, now);
    expect(statuses.find((s) => s.window === "morning")?.status).toBe("missed");
  });

  it("during the overnight gap, all windows are already resolved (missed) with none current", () => {
    const now = new Date("2026-07-25T23:30:00");
    const statuses = getCheckInStatuses([], now);
    expect(statuses.every((s) => s.status === "missed")).toBe(true);
  });

  it("before the first window starts, all windows are upcoming with none current", () => {
    const now = new Date("2026-07-25T03:00:00");
    const statuses = getCheckInStatuses([], now);
    expect(statuses.every((s) => s.status === "upcoming")).toBe(true);
  });

  it("an event exactly at a window's end boundary counts toward the next window, not the one ending", () => {
    const now = new Date("2026-07-25T13:00:00");
    const events = [
      ev({ eventTime: new Date("2026-07-25T12:00:00").toISOString() }), // exactly noon
    ];
    const statuses = getCheckInStatuses(events, now);
    expect(statuses.find((s) => s.window === "morning")?.status).toBe("missed");
    expect(statuses.find((s) => s.window === "afternoon")?.status).toBe("done");
  });
});
