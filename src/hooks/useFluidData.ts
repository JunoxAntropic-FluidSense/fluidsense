import { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import type { SummaryPeriod } from "../types";
import { getPeriodRange } from "../lib/period";
import { eventsInWindow, computeBalance } from "../lib/calc";
import { computeReliability } from "../lib/reliability";

export function useActivePatient() {
  const patients = useStore((s) => s.patients);
  const activePatientId = useStore((s) => s.activePatientId);
  return patients.find((p) => p.id === activePatientId) ?? patients[0];
}

export function useFluidData(periodOverride?: SummaryPeriod) {
  const [period, setPeriod] = useState<SummaryPeriod>(
    periodOverride ?? "monitoring_day"
  );
  const [customRange, setCustomRange] = useState<
    { start: Date; end: Date } | undefined
  >(undefined);
  const events = useStore((s) => s.events);
  const monitoringPeriods = useStore((s) => s.monitoringPeriods);
  const patient = useActivePatient();

  // Recomputed each render (not memoized) so newly-added events — timestamped
  // after any earlier "now" snapshot — still fall inside the window.
  const now = new Date();

  const activePeriod = useMemo(
    () =>
      patient
        ? (monitoringPeriods.find(
            (mp) => mp.profileId === patient.id && mp.status === "active"
          ) ?? null)
        : null,
    [monitoringPeriods, patient]
  );

  const range = useMemo(
    () =>
      getPeriodRange(period, now, {
        custom: customRange,
        patient,
        activePeriod,
      }),
    [period, customRange, patient, activePeriod, events.length]
  );

  const windowEvents = useMemo(
    () =>
      patient ? eventsInWindow(events, patient.id, range.start, range.end) : [],
    [events, patient, range]
  );

  const balance = useMemo(() => computeBalance(windowEvents), [windowEvents]);
  const reliability = useMemo(
    () => computeReliability(windowEvents, range.label, range.start, range.end),
    [windowEvents, range]
  );

  const lastEvent = windowEvents[0];

  return {
    patient,
    period,
    setPeriod,
    customRange,
    setCustomRange,
    range,
    windowEvents,
    balance,
    reliability,
    lastEvent,
    activePeriod,
  };
}
