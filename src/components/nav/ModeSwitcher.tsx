import { useStore } from "../../store/useStore";
import type { Mode } from "../../types";

export function ModeSwitcher() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);

  const opt = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      aria-pressed={mode === m}
      className={`flex-1 min-h-10 rounded-lg text-sm font-bold transition-colors ${
        mode === m ? "bg-white text-navy-900 shadow-sm" : "text-fog-600"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Switch app mode"
      className="flex gap-1 rounded-xl bg-fog-100 p-1 w-full max-w-xs"
    >
      {opt("patient", "Patient")}
      {opt("healthcare", "Healthcare team")}
    </div>
  );
}
