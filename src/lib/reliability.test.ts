import { describe, it, expect } from "vitest";
import { computeReliability } from "./reliability";
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

describe("computeReliability", () => {
  it("flags 'Moderate' when an entry relies on a container or approximate estimate", () => {
    const periodStart = new Date("2026-07-25T08:00:00.000Z");
    const periodEnd = new Date("2026-07-25T12:00:00.000Z");
    const events = [
      ev({
        direction: "intake",
        category: "water",
        amountMl: 200,
        status: "approximate",
        eventTime: new Date("2026-07-25T10:00:00.000Z").toISOString(),
      }),
    ];

    const result = computeReliability(events, "Today", periodStart, periodEnd);

    expect(result.level).toBe("Moderate");
    expect(result.reasons).toEqual([
      "1 entry relies on container or approximate estimates rather than exact measurement",
    ]);
  });

  it("flags 'Moderate' for container_estimated entries the same way as approximate", () => {
    const periodStart = new Date("2026-07-25T08:00:00.000Z");
    const periodEnd = new Date("2026-07-25T12:00:00.000Z");
    const events = [
      ev({
        direction: "intake",
        category: "water",
        amountMl: 200,
        status: "container_estimated",
        eventTime: new Date("2026-07-25T10:00:00.000Z").toISOString(),
      }),
    ];

    const result = computeReliability(events, "Today", periodStart, periodEnd);

    expect(result.level).toBe("Moderate");
    expect(result.reasons).toEqual([
      "1 entry relies on container or approximate estimates rather than exact measurement",
    ]);
  });

  it("produces an identical ReliabilityResult regardless of photoStoragePath presence", () => {
    const periodStart = new Date("2026-07-25T08:00:00.000Z");
    const periodEnd = new Date("2026-07-25T14:00:00.000Z");

    const withoutPhoto = ev({
      direction: "intake",
      category: "water",
      amountMl: 200,
      status: "approximate",
      eventTime: new Date("2026-07-25T10:00:00.000Z").toISOString(),
    });
    const withPhoto = ev({
      ...withoutPhoto,
      photoStoragePath: "p1/e1.jpg",
    });

    const resultWithoutPhoto = computeReliability(
      [withoutPhoto],
      "Today",
      periodStart,
      periodEnd
    );
    const resultWithPhoto = computeReliability(
      [withPhoto],
      "Today",
      periodStart,
      periodEnd
    );

    expect(resultWithPhoto).toEqual(resultWithoutPhoto);
  });
});
