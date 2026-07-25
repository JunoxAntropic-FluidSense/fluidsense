import { describe, it, expect } from "vitest";
import { computeBalance, describeUnmeasured } from "./calc";
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

  it("excludes rejected events from the confirmed balance entirely", () => {
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
        verificationStatus: "rejected",
      }),
      ev({
        direction: "output",
        category: "continence",
        status: "unmeasured",
        verificationStatus: "rejected",
      }),
    ];
    const balance = computeBalance(events);
    expect(balance.totalNumericOutputMl).toBe(0);
    expect(balance.unmeasuredCount).toBe(0);
    expect(balance.recordedBalanceMl).toBe(1000);
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

  it("produces identical output for events differing only in photoStoragePath", () => {
    const withoutPhoto = ev({
      direction: "intake",
      category: "water",
      amountMl: 200,
      status: "approximate",
    });
    const withPhoto = ev({
      ...withoutPhoto,
      photoStoragePath: "p1/e1.jpg",
    });
    expect(computeBalance([withPhoto])).toEqual(computeBalance([withoutPhoto]));
  });
});

describe("describeUnmeasured", () => {
  it("labels a menstrual pad event with its subtype", () => {
    const events = [
      ev({
        direction: "output",
        category: "menstrual_pad",
        status: "unmeasured",
        subtype: "moderate",
      }),
    ];
    expect(describeUnmeasured(events)).toEqual(["menstrual pad (moderate)"]);
  });

  it("labels a menstrual pad event with no subtype generically", () => {
    const events = [
      ev({
        direction: "output",
        category: "menstrual_pad",
        status: "unmeasured",
      }),
    ];
    expect(describeUnmeasured(events)).toEqual(["menstrual pad"]);
  });
});
