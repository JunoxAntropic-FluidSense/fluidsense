import { useStore } from "../../store/useStore";

export function PatientSwitcher() {
  const mode = useStore((s) => s.mode);
  const patients = useStore((s) => s.patients);
  const activePatientId = useStore((s) => s.activePatientId);
  const setActivePatient = useStore((s) => s.setActivePatient);

  if (mode !== "healthcare") return null;

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-semibold text-navy-700 whitespace-nowrap">
        Patient
      </span>
      <select
        value={activePatientId}
        onChange={(e) => setActivePatient(e.target.value)}
        className="min-h-11 rounded-xl border border-navy-900/15 bg-white px-3 text-sm font-semibold text-navy-900 max-w-[55vw] md:max-w-xs"
      >
        {patients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName} — {p.careSetting}
          </option>
        ))}
      </select>
    </label>
  );
}
