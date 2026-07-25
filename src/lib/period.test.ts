import { describe, it, expect } from "vitest";
import { getPeriodRange, needsMidnightRollover } from "./period";
import type { PatientProfile, MonitoringPeriod } from "../types";

const basePatient: PatientProfile = {
  id: "p1",
  displayName: "Test",
  careSetting: "Home",
  monitoringDayStartMode: "midnight",
  units: "mL",
  favouriteFluidIds: [],
  containers: [],
  quickButtons: [],
  dailyWeightEnabled: false,
  reminders: [],
};

describe("getPeriodRange", () => {
  it('rolling 24h always ends at "now" and starts 24 hours earlier', () => {
    const now = new Date("2026-07-24T14:30:00");
    const range = getPeriodRange("24h", now);
    expect(range.end).toEqual(now);
    expect(range.start.toISOString()).toBe(
      new Date("2026-07-23T14:30:00").toISOString()
    );
  });

  it("since_midnight starts at 00:00 today regardless of monitoring-day settings", () => {
    const now = new Date("2026-07-24T14:30:00");
    const range = getPeriodRange("since_midnight", now, {
      patient: {
        ...basePatient,
        monitoringDayStartMode: "custom_time",
        monitoringDayCustomHour: 8,
      },
    });
    expect(range.start.getHours()).toBe(0);
    expect(range.start.getMinutes()).toBe(0);
  });

  it("previous_day covers the full previous calendar day, not today", () => {
    const now = new Date("2026-07-24T14:30:00");
    const range = getPeriodRange("previous_day", now);
    expect(range.start.toISOString()).toBe(
      new Date("2026-07-23T00:00:00").toISOString()
    );
    expect(range.end.toISOString()).toBe(
      new Date("2026-07-24T00:00:00").toISOString()
    );
  });

  it("monitoring_day with custom_time rolls back to yesterday's start hour if that time hasn't happened yet today", () => {
    const now = new Date("2026-07-24T05:00:00"); // before 08:00
    const patient = {
      ...basePatient,
      monitoringDayStartMode: "custom_time" as const,
      monitoringDayCustomHour: 8,
    };
    const range = getPeriodRange("monitoring_day", now, { patient });
    expect(range.start.toISOString()).toBe(
      new Date("2026-07-23T08:00:00").toISOString()
    );
  });

  it('"Start new day" resets the monitoring day even in midnight mode (the default)', () => {
    const now = new Date("2026-07-24T14:30:00");
    const patient = {
      ...basePatient,
      monitoringDayStartMode: "midnight" as const,
    };
    const activePeriod: MonitoringPeriod = {
      id: "mp1",
      profileId: "p1",
      startTime: new Date("2026-07-24T12:00:00").toISOString(),
      endTime: null,
      type: "manual",
      status: "active",
      createdBy: "Test",
    };
    const range = getPeriodRange("monitoring_day", now, {
      patient,
      activePeriod,
    });
    expect(range.start.toISOString()).toBe(
      new Date("2026-07-24T12:00:00").toISOString()
    );
  });

  it("a manually-started day defers back to midnight once a new natural day has passed", () => {
    const now = new Date("2026-07-25T09:00:00"); // next day, after midnight
    const patient = {
      ...basePatient,
      monitoringDayStartMode: "midnight" as const,
    };
    const activePeriod: MonitoringPeriod = {
      id: "mp1",
      profileId: "p1",
      startTime: new Date("2026-07-24T12:00:00").toISOString(), // started yesterday
      endTime: null,
      type: "manual",
      status: "active",
      createdBy: "Test",
    };
    const range = getPeriodRange("monitoring_day", now, {
      patient,
      activePeriod,
    });
    expect(range.start.toISOString()).toBe(
      new Date("2026-07-25T00:00:00").toISOString()
    );
  });

  it("monitoring_day with on_demand mode uses the active monitoring period's start time", () => {
    const now = new Date("2026-07-24T14:30:00");
    const patient = {
      ...basePatient,
      monitoringDayStartMode: "on_demand" as const,
    };
    const activePeriod: MonitoringPeriod = {
      id: "mp1",
      profileId: "p1",
      startTime: new Date("2026-07-24T09:15:00").toISOString(),
      endTime: null,
      type: "manual",
      status: "active",
      createdBy: "Test",
    };
    const range = getPeriodRange("monitoring_day", now, {
      patient,
      activePeriod,
    });
    expect(range.start.toISOString()).toBe(
      new Date("2026-07-24T09:15:00").toISOString()
    );
  });

  it("distinguishes monitoring_day from since_midnight and rolling 24h (never confused)", () => {
    const now = new Date("2026-07-24T05:00:00");
    const patient = {
      ...basePatient,
      monitoringDayStartMode: "custom_time" as const,
      monitoringDayCustomHour: 8,
    };
    const monitoringDay = getPeriodRange("monitoring_day", now, { patient });
    const sinceMidnight = getPeriodRange("since_midnight", now, { patient });
    const rolling24h = getPeriodRange("24h", now, { patient });
    expect(monitoringDay.start.getTime()).not.toBe(
      sinceMidnight.start.getTime()
    );
    expect(monitoringDay.start.getTime()).not.toBe(rolling24h.start.getTime());
  });
});

describe("needsMidnightRollover", () => {
  it("is false when the period started earlier today", () => {
    const now = new Date("2026-07-24T23:50:00");
    const startedToday = new Date("2026-07-24T00:05:00").toISOString();
    expect(needsMidnightRollover(startedToday, now)).toBe(false);
  });

  it("is true once at least one midnight has passed since the period started", () => {
    const now = new Date("2026-07-25T00:05:00");
    const startedYesterday = new Date("2026-07-24T09:00:00").toISOString();
    expect(needsMidnightRollover(startedYesterday, now)).toBe(true);
  });

  it("is true across a multi-day gap, not just a single day boundary", () => {
    const now = new Date("2026-07-28T10:00:00");
    const startedDaysAgo = new Date("2026-07-24T09:00:00").toISOString();
    expect(needsMidnightRollover(startedDaysAgo, now)).toBe(true);
  });
});
