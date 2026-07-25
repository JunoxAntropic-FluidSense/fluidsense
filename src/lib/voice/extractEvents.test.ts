import { describe, it, expect } from "vitest";
import { extractVoiceEvents } from "./extractEvents";
import type { PatientProfile } from "../../types";

const patient: PatientProfile = {
  id: "p1",
  displayName: "Test Patient",
  careSetting: "Home",
  monitoringDayStartMode: "midnight",
  units: "mL",
  favouriteFluidIds: [],
  containers: [
    { id: "c1", name: "Hospital cup", fullVolumeMl: 180, isStandard: true },
    { id: "c2", name: "Blue mug", fullVolumeMl: 300 },
    { id: "c3", name: "Personal bottle", fullVolumeMl: 500 },
  ],
  quickButtons: [],
  dailyWeightEnabled: false,
  reminders: [],
};

function firstEvent(transcript: string) {
  const result = extractVoiceEvents(transcript, {
    patient,
    fluidProfiles: [],
    recentEvents: [],
  });
  return result.events[0];
}

describe("intake extraction", () => {
  it('parses "I drank 250 mils of water."', () => {
    const e = firstEvent("I drank 250 mils of water.");
    expect(e.direction).toBe("intake");
    expect(e.category).toBe("water");
    expect(e.amountMl).toBe(250);
    expect(e.measurementStatus).toBe("measured");
  });

  it('parses "I had two fifty of coffee." with an interpretation note', () => {
    const e = firstEvent("I had two fifty of coffee.");
    expect(e.direction).toBe("intake");
    expect(e.category).toBe("coffee");
    expect(e.amountMl).toBe(250);
  });

  it('parses "I finished half my 500 mL bottle." as container-estimated 250 mL', () => {
    const e = firstEvent("I finished half my 500 mL bottle.");
    expect(e.direction).toBe("intake");
    expect(e.amountMl).toBe(250);
    expect(e.measurementStatus).toBe("container_estimated");
  });

  it('parses "I drank one point five litres." as 1500 mL', () => {
    const e = firstEvent("I drank one point five litres.");
    expect(e.direction).toBe("intake");
    expect(e.amountMl).toBe(1500);
  });

  it('parses "The patient had one hospital cup of tea." using the saved container volume', () => {
    const e = firstEvent("The patient had one hospital cup of tea.");
    expect(e.direction).toBe("intake");
    expect(e.category).toBe("tea");
    expect(e.amountMl).toBe(180);
  });
});

describe("output extraction", () => {
  it('parses "I peed 500 mils." as measured urine', () => {
    const e = firstEvent("I peed 500 mils.");
    expect(e.direction).toBe("output");
    expect(e.category).toBe("urine");
    expect(e.amountMl).toBe(500);
    expect(e.measurementStatus).toBe("measured");
  });

  it('parses "I passed two fifty urine." as 250 mL', () => {
    const e = firstEvent("I passed two fifty urine.");
    expect(e.direction).toBe("output");
    expect(e.category).toBe("urine");
    expect(e.amountMl).toBe(250);
  });

  it('parses "The catheter bag had four hundred cc." as 400 mL urine', () => {
    const e = firstEvent("The catheter bag had four hundred cc.");
    expect(e.direction).toBe("output");
    expect(e.category).toBe("urine");
    expect(e.amountMl).toBe(400);
  });

  it('parses "I went to the toilet but did not measure it." as unmeasured urine', () => {
    const e = firstEvent("I went to the toilet but did not measure it.");
    expect(e.direction).toBe("output");
    expect(e.category).toBe("urine");
    expect(e.amountMl).toBeUndefined();
    expect(e.measurementStatus).toBe("unmeasured");
  });

  it('parses "The patient had a heavily wet pad." as unmeasured continence', () => {
    const e = firstEvent("The patient had a heavily wet pad.");
    expect(e.direction).toBe("output");
    expect(e.category).toBe("continence");
    expect(e.measurementStatus).toBe("unmeasured");
  });

  it('parses "I had two watery stools." as two unmeasured diarrhoea episodes', () => {
    const e = firstEvent("I had two watery stools.");
    expect(e.direction).toBe("output");
    expect(e.category).toBe("diarrhoea");
    expect(e.quantityOfEvents).toBe(2);
    expect(e.measurementStatus).toBe("unmeasured");
  });

  it('parses "I vomited half a cup." as an estimated vomit event', () => {
    const e = firstEvent("I vomited half a cup.");
    expect(e.direction).toBe("output");
    expect(e.category).toBe("vomit");
  });
});

describe("ambiguity handling", () => {
  it('flags "I had 250 mils." as direction-unknown', () => {
    const e = firstEvent("I had 250 mils.");
    expect(e.direction).toBe("unknown");
    expect(e.ambiguities.length).toBeGreaterThan(0);
  });

  it('parses "I had some water." as intake with unknown amount', () => {
    const e = firstEvent("I had some water.");
    expect(e.direction).toBe("intake");
    expect(e.category).toBe("water");
    expect(e.amountMl).toBeUndefined();
    expect(e.measurementStatus).toBe("unmeasured");
  });
});

describe("multiple events in one sentence", () => {
  it('splits "I drank 200 mL water and passed 350 mL urine." into two events', () => {
    const result = extractVoiceEvents(
      "I drank 200 mL water and passed 350 mL urine.",
      { patient, fluidProfiles: [], recentEvents: [] }
    );
    expect(result.events).toHaveLength(2);
    expect(result.events[0].direction).toBe("intake");
    expect(result.events[0].amountMl).toBe(200);
    expect(result.events[1].direction).toBe("output");
    expect(result.events[1].amountMl).toBe(350);
  });

  it('splits "One cup of tea and two watery stools." into an intake and an output event', () => {
    const result = extractVoiceEvents("One cup of tea and two watery stools.", {
      patient,
      fluidProfiles: [],
      recentEvents: [],
    });
    expect(result.events).toHaveLength(2);
    expect(result.events[0].direction).toBe("intake");
    expect(result.events[0].category).toBe("tea");
    expect(result.events[1].direction).toBe("output");
    expect(result.events[1].category).toBe("diarrhoea");
    expect(result.events[1].quantityOfEvents).toBe(2);
  });

  it("splits a three-part sentence into three events", () => {
    const result = extractVoiceEvents(
      "The patient had one cup of tea, 200 mL of water and two watery stools.",
      { patient, fluidProfiles: [], recentEvents: [] }
    );
    expect(result.events).toHaveLength(3);
    expect(result.events[0].category).toBe("tea");
    expect(result.events[1].category).toBe("water");
    expect(result.events[1].amountMl).toBe(200);
    expect(result.events[2].category).toBe("diarrhoea");
  });
});

describe("summary requests", () => {
  it('recognises "Summarise the last 24 hours." as a summary request', () => {
    const result = extractVoiceEvents("Summarise the last 24 hours.", {
      patient,
      fluidProfiles: [],
      recentEvents: [],
    });
    expect(result.intent).toBe("request_summary");
    expect(result.events).toHaveLength(0);
  });
});
