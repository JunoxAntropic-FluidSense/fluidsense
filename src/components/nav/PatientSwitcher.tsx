import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/useStore";
import { Select } from "../ui/Field";
import { Button } from "../ui/Button";

export function PatientSwitcher() {
  const mode = useStore((s) => s.mode);
  const patients = useStore((s) => s.patients);
  const activePatientId = useStore((s) => s.activePatientId);
  const setActivePatient = useStore((s) => s.setActivePatient);
  const navigate = useNavigate();

  if (mode !== "healthcare") return null;

  if (patients.length === 0) {
    return (
      <Button
        size="md"
        variant="primary"
        onClick={() => navigate("/dashboard?addPatient=true")}
        className="flex items-center gap-1.5 whitespace-nowrap text-xs font-bold px-3 py-1.5 min-h-9 rounded-full shadow-sm"
      >
        <span>+ Add your first patient</span>
      </Button>
    );
  }

  const handleChange = (val: string) => {
    if (val === "ADD_NEW") {
      navigate("/dashboard?addPatient=true");
    } else {
      setActivePatient(val);
    }
  };

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-semibold text-navy-700 whitespace-nowrap hidden sm:inline">
        Patient
      </span>
      <Select
        value={activePatientId || ""}
        onChange={(e) => handleChange(e.target.value)}
        className="min-h-10 py-0 text-sm font-semibold max-w-[55vw] md:max-w-xs rounded-full"
      >
        {!activePatientId && (
          <option value="" disabled>
            Select patient…
          </option>
        )}
        {patients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName} — {p.careSetting}
          </option>
        ))}
        <option value="ADD_NEW">+ Add new patient…</option>
      </Select>
    </label>
  );
}
