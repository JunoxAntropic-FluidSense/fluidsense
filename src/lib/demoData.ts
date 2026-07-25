import { v4 as uuid } from "uuid";
import { subHours, subDays } from "date-fns";
import type {
  PatientProfile,
  FluidProfile,
  FluidEvent,
  WeightEvent,
  SavedContainer,
  QuickButtonPref,
  MonitoringPeriod,
} from "../types";

// Demo data is generated fresh (relative timestamps recomputed against "now")
// every time demo mode is entered. It is never persisted and never merges
// with real user data — see enterDemoMode()/exitDemoMode() in useStore.ts.

export const PATIENT_A_ID = "demo-patient-a-aki";
export const PATIENT_B_ID = "demo-patient-b-hf";
export const PATIENT_HOME_ID = "demo-patient-home";

const blueMug: SavedContainer = {
  id: "demo-c-blue-mug",
  name: "Blue mug",
  fullVolumeMl: 300,
};
const hospitalCup: SavedContainer = {
  id: "demo-c-hospital-cup",
  name: "Hospital cup",
  fullVolumeMl: 180,
  isStandard: true,
};
const waterGlass: SavedContainer = {
  id: "demo-c-water-glass",
  name: "Water glass",
  fullVolumeMl: 250,
  isStandard: true,
};
const personalBottle: SavedContainer = {
  id: "demo-c-personal-bottle",
  name: "Personal bottle",
  fullVolumeMl: 500,
};
const soupBowl: SavedContainer = {
  id: "demo-c-soup-bowl",
  name: "Soup bowl",
  fullVolumeMl: 350,
  isStandard: true,
};

const quickButtons = (): QuickButtonPref[] => [
  {
    id: uuid(),
    kind: "intake",
    category: "water",
    label: "Water",
    order: 0,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "intake",
    category: "tea",
    label: "Tea",
    order: 1,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "intake",
    category: "coffee",
    label: "Coffee",
    order: 2,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "intake",
    category: "juice",
    label: "Juice",
    order: 3,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "intake",
    category: "milk",
    label: "Milk",
    order: 4,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "intake",
    category: "soup",
    label: "Soup",
    order: 5,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "intake",
    category: "nutritional_drink",
    label: "Nutritional drink",
    order: 6,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "intake",
    category: "iv_fluid",
    label: "IV fluid",
    order: 7,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "intake",
    category: "other_intake",
    label: "Other intake",
    order: 8,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "output",
    category: "urine",
    label: "Measured urine",
    order: 9,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "output",
    category: "urine",
    label: "Unmeasured urine",
    order: 10,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "output",
    category: "continence",
    label: "Wet pad (urine)",
    order: 11,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "output",
    category: "vomit",
    label: "Vomiting",
    order: 12,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "output",
    category: "diarrhoea",
    label: "Diarrhoea",
    order: 13,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "output",
    category: "stoma",
    label: "Stoma output",
    order: 14,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "output",
    category: "drain",
    label: "Drain output",
    order: 15,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "output",
    category: "sweating",
    label: "Sweating",
    order: 16,
    enabled: true,
  },
  {
    id: uuid(),
    kind: "output",
    category: "other_output",
    label: "Other output",
    order: 17,
    enabled: true,
  },
];

export interface DemoDataset {
  patients: PatientProfile[];
  fluidProfiles: FluidProfile[];
  events: FluidEvent[];
  weightEvents: WeightEvent[];
  monitoringPeriods: MonitoringPeriod[];
}

export function generateDemoData(now: Date = new Date()): DemoDataset {
  const at = (hoursAgo: number) => subHours(now, hoursAgo).toISOString();
  const atDay = (daysAgo: number, hour: number) => {
    const d = subDays(now, daysAgo);
    d.setHours(hour, Math.floor(Math.random() * 50), 0, 0);
    return d.toISOString();
  };

  const fluidProfiles: FluidProfile[] = [
    {
      id: "demo-fp-blue-mug-coffee",
      name: "Blue mug coffee",
      category: "coffee",
      containerId: blueMug.id,
      containerVolumeMl: 300,
      usualServingFraction: 1,
      waterContentPercent: 98,
      waterContentSource: "User-entered estimate",
      verified: false,
      favourite: true,
    },
    {
      id: "demo-fp-nutriboost",
      name: "NutriBoost Vanilla",
      brand: "NutriBoost (fictional)",
      category: "nutritional_drink",
      containerVolumeMl: 200,
      usualServingFraction: 1,
      waterContentPercent: 78,
      waterContentSource: "Product information (demo)",
      verified: true,
      favourite: true,
    },
    {
      id: "demo-fp-soup",
      name: "Homemade soup",
      category: "soup",
      containerId: soupBowl.id,
      containerVolumeMl: 350,
      usualServingFraction: 0.75,
      waterContentPercent: 90,
      waterContentSource: "User-entered estimate",
      verified: false,
      favourite: true,
    },
    {
      id: "demo-fp-water-glass",
      name: "Water",
      category: "water",
      containerId: waterGlass.id,
      containerVolumeMl: 250,
      usualServingFraction: 1,
      verified: true,
      favourite: true,
    },
    {
      id: "demo-fp-personal-bottle-water",
      name: "Personal bottle water",
      category: "water",
      containerId: personalBottle.id,
      containerVolumeMl: 500,
      usualServingFraction: 1,
      verified: true,
      favourite: true,
    },
    {
      id: "demo-fp-hospital-tea",
      name: "Hospital tea",
      category: "tea",
      containerId: hospitalCup.id,
      containerVolumeMl: 180,
      usualServingFraction: 1,
      waterContentPercent: 97,
      waterContentSource: "Approved reference (demo)",
      verified: true,
      favourite: true,
    },
  ];

  const patients: PatientProfile[] = [
    {
      id: PATIENT_A_ID,
      displayName: "Demo Patient A",
      careSetting: "Ward 4B, Bed 3 (fictional)",
      monitoringReason: "Fluid monitoring — acute kidney injury (demo)",
      allowance: {
        dailyMl: 1500,
        setByName: "Dr. Amara Osei (demo)",
        setByRole: "clinician",
        setAt: at(20),
      },
      monitoringDayStartMode: "midnight",
      units: "mL",
      favouriteFluidIds: ["demo-fp-hospital-tea", "demo-fp-water-glass"],
      containers: [hospitalCup, waterGlass],
      quickButtons: quickButtons(),
      dailyWeightEnabled: true,
      reminders: [
        { id: uuid(), kind: "record_output", enabled: true, intervalHours: 4 },
        { id: uuid(), kind: "evening_review", enabled: true },
      ],
      contactInstructions:
        "Contact Ward 4B nursing station for review of this chart (demo instructions).",
      isDemo: true,
    },
    {
      id: PATIENT_B_ID,
      displayName: "Demo Patient B",
      careSetting: "Ward 2A, Bed 7 (fictional)",
      monitoringReason: "Fluid monitoring — heart failure (demo)",
      allowance: {
        dailyMl: 1200,
        setByName: "Dr. Amara Osei (demo)",
        setByRole: "clinician",
        setAt: at(40),
      },
      monitoringDayStartMode: "midnight",
      units: "mL",
      favouriteFluidIds: ["demo-fp-hospital-tea"],
      containers: [hospitalCup, waterGlass],
      quickButtons: quickButtons(),
      dailyWeightEnabled: true,
      reminders: [{ id: uuid(), kind: "daily_weight", enabled: true }],
      contactInstructions:
        "Contact Ward 2A nursing station for review of this chart (demo instructions).",
      isDemo: true,
    },
    {
      id: PATIENT_HOME_ID,
      displayName: "Home Demo User",
      careSetting: "Home monitoring (fictional)",
      monitoringReason: "Home fluid tracking (demo)",
      monitoringDayStartMode: "midnight",
      units: "mL",
      favouriteFluidIds: [
        "demo-fp-blue-mug-coffee",
        "demo-fp-nutriboost",
        "demo-fp-soup",
      ],
      containers: [blueMug, personalBottle, soupBowl],
      quickButtons: quickButtons(),
      dailyWeightEnabled: false,
      reminders: [
        { id: uuid(), kind: "record_drink", enabled: true, intervalHours: 6 },
      ],
      isDemo: true,
    },
  ];

  let counter = 0;
  function mkEvent(
    partial: Partial<FluidEvent> &
      Pick<
        FluidEvent,
        | "patientId"
        | "direction"
        | "category"
        | "status"
        | "unit"
        | "eventTime"
        | "enteredBy"
        | "inputMethod"
      >
  ): FluidEvent {
    counter += 1;
    return {
      id: `demo-evt-${counter}-${uuid().slice(0, 8)}`,
      recordedTime: partial.eventTime,
      ...partial,
    };
  }

  const events: FluidEvent[] = [];
  const weightEvents: WeightEvent[] = [];

  // ===== Patient A — AKI, LOW reliability (last 24h) ===============================
  {
    const p = PATIENT_A_ID;
    events.push(
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "tea",
        subtype: "hospital_tea",
        amountMl: 180,
        unit: "mL",
        status: "measured",
        containerId: hospitalCup.id,
        containerFraction: 1,
        fluidProfileId: "demo-fp-hospital-tea",
        waterContentPercent: 97,
        estimatedWaterContributionMl: 175,
        eventTime: at(22),
        enteredBy: "Staff Nurse J. Patel",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "water",
        amountMl: 250,
        unit: "mL",
        status: "measured",
        containerId: waterGlass.id,
        containerFraction: 1,
        eventTime: at(19),
        enteredBy: "Staff Nurse J. Patel",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "iv_fluid",
        amountMl: 500,
        unit: "mL",
        status: "measured",
        eventTime: at(18),
        enteredBy: "Staff Nurse J. Patel",
        inputMethod: "manual",
        note: "0.9% saline, 500 mL bag",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "urine",
        subtype: "measured_urine",
        amountMl: 300,
        unit: "mL",
        status: "measured",
        eventTime: at(17),
        enteredBy: "Staff Nurse J. Patel",
        inputMethod: "manual",
        note: "Measured in bottle",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "urine",
        subtype: "unmeasured_toilet",
        status: "unmeasured",
        unit: "mL",
        eventTime: at(13),
        enteredBy: "Healthcare Assistant R. Kowalski",
        inputMethod: "voice",
        transcript: "The patient went to the toilet but we did not measure it.",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "urine",
        subtype: "unmeasured_toilet",
        status: "unmeasured",
        unit: "mL",
        eventTime: at(8),
        enteredBy: "Healthcare Assistant R. Kowalski",
        inputMethod: "manual",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "continence",
        subtype: "heavily_wet_pad",
        status: "unmeasured",
        unit: "mL",
        eventTime: at(6),
        enteredBy: "Healthcare Assistant R. Kowalski",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "diarrhoea",
        subtype: "watery",
        status: "unmeasured",
        unit: "mL",
        episodeCount: 2,
        eventTime: at(5),
        enteredBy: "Staff Nurse J. Patel",
        inputMethod: "voice",
        transcript: "The patient had two episodes of watery diarrhoea.",
        note: "Two episodes, watery",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "juice",
        amountMl: 120,
        unit: "mL",
        status: "approximate",
        eventTime: at(3),
        enteredBy: "Healthcare Assistant R. Kowalski",
        inputMethod: "tap",
      })
    );
    weightEvents.push({
      id: uuid(),
      patientId: p,
      weightKg: 78.4,
      time: at(20),
      note: "Morning weight",
    });

    events.push(
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "tea",
        amountMl: 180,
        unit: "mL",
        status: "measured",
        containerId: hospitalCup.id,
        containerFraction: 1,
        eventTime: atDay(1, 8),
        enteredBy: "Staff Nurse M. Ibrahim",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "water",
        amountMl: 250,
        unit: "mL",
        status: "measured",
        eventTime: atDay(1, 11),
        enteredBy: "Staff Nurse M. Ibrahim",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "iv_fluid",
        amountMl: 500,
        unit: "mL",
        status: "measured",
        eventTime: atDay(1, 14),
        enteredBy: "Staff Nurse M. Ibrahim",
        inputMethod: "manual",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "urine",
        amountMl: 400,
        unit: "mL",
        status: "measured",
        eventTime: atDay(1, 12),
        enteredBy: "Staff Nurse M. Ibrahim",
        inputMethod: "manual",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "urine",
        status: "unmeasured",
        unit: "mL",
        eventTime: atDay(1, 18),
        enteredBy: "Healthcare Assistant R. Kowalski",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "soup",
        amountMl: 260,
        unit: "mL",
        status: "container_estimated",
        containerId: soupBowl.id,
        containerFraction: 0.75,
        eventTime: atDay(1, 19),
        enteredBy: "Staff Nurse M. Ibrahim",
        inputMethod: "manual",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "tea",
        amountMl: 180,
        unit: "mL",
        status: "measured",
        eventTime: atDay(2, 9),
        enteredBy: "Staff Nurse M. Ibrahim",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "urine",
        amountMl: 350,
        unit: "mL",
        status: "measured",
        eventTime: atDay(2, 13),
        enteredBy: "Staff Nurse M. Ibrahim",
        inputMethod: "manual",
      })
    );
    weightEvents.push(
      { id: uuid(), patientId: p, weightKg: 78.9, time: atDay(1, 8) },
      { id: uuid(), patientId: p, weightKg: 79.1, time: atDay(2, 8) }
    );
  }

  // ===== Patient B — heart failure, HIGH reliability =================================
  {
    const p = PATIENT_B_ID;
    events.push(
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "tea",
        amountMl: 180,
        unit: "mL",
        status: "measured",
        containerId: hospitalCup.id,
        containerFraction: 1,
        eventTime: at(21),
        enteredBy: "Staff Nurse L. Novak",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "water",
        amountMl: 200,
        unit: "mL",
        status: "measured",
        eventTime: at(17),
        enteredBy: "Staff Nurse L. Novak",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "iv_medication",
        amountMl: 50,
        unit: "mL",
        status: "measured",
        eventTime: at(15),
        enteredBy: "Staff Nurse L. Novak",
        inputMethod: "manual",
        note: "IV flush",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "urine",
        amountMl: 350,
        unit: "mL",
        status: "measured",
        eventTime: at(20),
        enteredBy: "Staff Nurse L. Novak",
        inputMethod: "manual",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "urine",
        amountMl: 300,
        unit: "mL",
        status: "measured",
        eventTime: at(14),
        enteredBy: "Staff Nurse L. Novak",
        inputMethod: "manual",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "urine",
        amountMl: 280,
        unit: "mL",
        status: "measured",
        eventTime: at(9),
        enteredBy: "Staff Nurse L. Novak",
        inputMethod: "voice",
        transcript:
          "The patient passed 280 millilitres of urine into the bottle.",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "water",
        amountMl: 150,
        unit: "mL",
        status: "measured",
        eventTime: at(11),
        enteredBy: "Staff Nurse L. Novak",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "tea",
        amountMl: 180,
        unit: "mL",
        status: "measured",
        eventTime: at(6),
        enteredBy: "Staff Nurse L. Novak",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "urine",
        amountMl: 260,
        unit: "mL",
        status: "measured",
        eventTime: at(3),
        enteredBy: "Staff Nurse L. Novak",
        inputMethod: "manual",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "water",
        amountMl: 100,
        unit: "mL",
        status: "measured",
        eventTime: at(1),
        enteredBy: "Staff Nurse L. Novak",
        inputMethod: "tap",
      })
    );
    weightEvents.push({
      id: uuid(),
      patientId: p,
      weightKg: 84.2,
      time: at(20),
      note: "Daily weight, same scale, before breakfast",
    });
    weightEvents.push(
      { id: uuid(), patientId: p, weightKg: 84.4, time: atDay(1, 8) },
      { id: uuid(), patientId: p, weightKg: 84.1, time: atDay(2, 8) }
    );

    events.push(
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "water",
        amountMl: 200,
        unit: "mL",
        status: "measured",
        eventTime: atDay(1, 9),
        enteredBy: "Staff Nurse D. Osei",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "tea",
        amountMl: 180,
        unit: "mL",
        status: "measured",
        eventTime: atDay(1, 15),
        enteredBy: "Staff Nurse D. Osei",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "urine",
        amountMl: 320,
        unit: "mL",
        status: "measured",
        eventTime: atDay(1, 11),
        enteredBy: "Staff Nurse D. Osei",
        inputMethod: "manual",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "urine",
        amountMl: 290,
        unit: "mL",
        status: "measured",
        eventTime: atDay(1, 19),
        enteredBy: "Staff Nurse D. Osei",
        inputMethod: "manual",
      })
    );
  }

  // ===== Home Demo User — MODERATE reliability =======================================
  {
    const p = PATIENT_HOME_ID;
    events.push(
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "coffee",
        amountMl: 150,
        unit: "mL",
        status: "container_estimated",
        containerId: blueMug.id,
        containerFraction: 0.5,
        fluidProfileId: "demo-fp-blue-mug-coffee",
        waterContentPercent: 98,
        estimatedWaterContributionMl: 147,
        eventTime: at(23),
        enteredBy: "You",
        inputMethod: "tap",
        note: "I just drank half a cup of coffee.",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "water",
        amountMl: 500,
        unit: "mL",
        status: "measured",
        containerId: personalBottle.id,
        containerFraction: 1,
        eventTime: at(20),
        enteredBy: "You",
        inputMethod: "voice",
        transcript: "I finished my 500 mL bottle of water.",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "urine",
        subtype: "unmeasured_toilet",
        status: "unmeasured",
        unit: "mL",
        eventTime: at(18),
        enteredBy: "You",
        inputMethod: "voice",
        transcript: "I went to the toilet but did not measure the urine.",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "soup",
        amountMl: 263,
        unit: "mL",
        status: "container_estimated",
        containerId: soupBowl.id,
        containerFraction: 0.75,
        fluidProfileId: "demo-fp-soup",
        waterContentPercent: 90,
        estimatedWaterContributionMl: 237,
        eventTime: at(14),
        enteredBy: "You",
        inputMethod: "manual",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "vomit",
        status: "approximate",
        amountMl: 50,
        unit: "mL",
        eventTime: at(11),
        enteredBy: "You",
        inputMethod: "tap",
        note: "Small vomit",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "nutritional_drink",
        amountMl: 200,
        unit: "mL",
        status: "measured",
        fluidProfileId: "demo-fp-nutriboost",
        waterContentPercent: 78,
        estimatedWaterContributionMl: 156,
        eventTime: at(9),
        enteredBy: "You",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "urine",
        amountMl: 150,
        unit: "mL",
        status: "measured",
        eventTime: at(4),
        enteredBy: "You",
        inputMethod: "manual",
        note: "Measured in bottle",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "water",
        amountMl: 200,
        unit: "mL",
        status: "measured",
        eventTime: at(2),
        enteredBy: "You",
        inputMethod: "tap",
      })
    );

    events.push(
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "water",
        amountMl: 250,
        unit: "mL",
        status: "measured",
        eventTime: atDay(1, 9),
        enteredBy: "You",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "coffee",
        amountMl: 300,
        unit: "mL",
        status: "container_estimated",
        containerId: blueMug.id,
        containerFraction: 1,
        eventTime: atDay(1, 8),
        enteredBy: "You",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "urine",
        subtype: "unmeasured_toilet",
        status: "unmeasured",
        unit: "mL",
        eventTime: atDay(1, 12),
        enteredBy: "You",
        inputMethod: "tap",
      }),
      mkEvent({
        patientId: p,
        direction: "intake",
        category: "juice",
        amountMl: 200,
        unit: "mL",
        status: "measured",
        eventTime: atDay(1, 17),
        enteredBy: "You",
        inputMethod: "manual",
      }),
      mkEvent({
        patientId: p,
        direction: "output",
        category: "sweating",
        status: "unmeasured",
        unit: "mL",
        subtype: "moderate",
        eventTime: atDay(1, 20),
        enteredBy: "You",
        inputMethod: "manual",
      })
    );
  }

  const monitoringPeriods: MonitoringPeriod[] = patients.map((p) => ({
    id: `demo-mp-${p.id}`,
    profileId: p.id,
    startTime: subHours(now, 24).toISOString(),
    endTime: null,
    type: "rolling_24h",
    status: "active",
    createdBy: "demo",
  }));

  return { patients, fluidProfiles, events, weightEvents, monitoringPeriods };
}
