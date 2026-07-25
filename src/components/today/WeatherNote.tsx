import { useState } from "react";
import { Sun } from "@phosphor-icons/react";
import { useWeather } from "../../hooks/useWeather";

export function WeatherNote() {
  const weather = useWeather();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (weather.status !== "ready" || !weather.context.isWarmerThanUsual)
    return null;

  const temp = Math.round(weather.context.currentTempC);

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-2xl bg-sky-50 border border-sky-200 px-4 py-3"
    >
      <Sun
        size={20}
        weight="fill"
        className="shrink-0 text-amber-500"
        aria-hidden="true"
      />
      <p className="flex-1 text-sm text-sky-800">
        Today: {temp}°C — warmer than the recent average for this location.
        Fluid needs can vary with temperature — worth keeping intake and output
        logging consistent today.
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss weather note"
        className="text-sky-700 font-bold text-lg min-h-8 min-w-8"
      >
        ×
      </button>
    </div>
  );
}
