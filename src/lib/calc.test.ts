import { describe, it, expect } from "vitest";
import { computeBalance } from "./calc";
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

describe("computeBalance", () => {
  it("separates measured and estimated intake, and computes total", () => {
    const events = [
      ev({
        direction: "intake",
        category: "water",
        amountMl: 250,
        status: "measured",
      }),
      ev({
        direction: "intake",
        category: "coffee",
        amountMl: 150,
        status: "container_estimated",
      }),
      ev({
        direction: "intake",
        category: "juice",
        amountMl: 100,
        status: "approximate",
      }),
    ];
    const balance = computeBalance(events);
    expect(balance.measuredIntakeMl).toBe(250);
    expect(balance.estimatedIntakeMl).toBe(250);
    expect(balance.totalIntakeMl).toBe(500);
  });

  it("splits oral vs IV intake", () => {
    const events = [
      ev({
        direction: "intake",
        category: "water",
        amountMl: 200,
        status: "measured",
      }),
      ev({
        direction: "intake",
        category: "iv_fluid",
        amountMl: 500,
        status: "measured",
      }),
    ];
    const balance = computeBalance(events);
    expect(balance.oralIntakeMl).toBe(200);
    expect(balance.ivIntakeMl).toBe(500);
  });

  it("excludes unmeasured events from the numerical balance but counts them separately", () => {
    const events = [
      ev({
        direction: "intake",
        category: "water",
        amountMl: 300,
        status: "measured",
      }),
      ev({ direction: "output", category: "urine", status: "unmeasured" }),
      ev({
        direction: "output",
        category: "diarrhoea",
        status: "unmeasured",
        episodeCount: 2,
      }),
    ];
    const balance = computeBalance(events);
    expect(balance.totalNumericOutputMl).toBe(0);
    expect(balance.unmeasuredCount).toBe(2);
    expect(balance.recordedBalanceMl).toBe(300);
  });

  it("computes recorded balance as intake minus numeric output", () => {
    const events = [
      ev({
        direction: "intake",
        category: "water",
        amountMl: 1000,
        status: "measured",
      }),
      ev({
        direction: "output",
        category: "urine",
        amountMl: 400,
        status: "measured",
      }),
    ];
    const balance = computeBalance(events);
    expect(balance.recordedBalanceMl).toBe(600);
  });
});
