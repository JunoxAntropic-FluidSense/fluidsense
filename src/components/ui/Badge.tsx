import type { ReactNode } from "react";
import type { MeasurementStatus } from "../../types";

const STATUS_STYLE: Record<MeasurementStatus, string> = {
  measured: "bg-intake-100 text-intake-700 border border-intake-200",
  container_estimated: "bg-amber-100 text-amber-700 border border-amber-200",
  approximate: "bg-amber-100 text-amber-700 border border-amber-200",
  unmeasured: "bg-fog-100 text-fog-700 border border-fog-200",
};

const STATUS_ICON: Record<MeasurementStatus, string> = {
  measured: "✓", // check
  container_estimated: "≈", // approx
  approximate: "≈",
  unmeasured: "—", // dash
};

const STATUS_TEXT: Record<MeasurementStatus, string> = {
  measured: "Measured",
  container_estimated: "Container estimate",
  approximate: "Approximate",
  unmeasured: "Unmeasured",
};

export function StatusBadge({
  status,
  className = "",
}: {
  status: MeasurementStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]} ${className}`}
    >
      <span aria-hidden="true">{STATUS_ICON[status]}</span>
      {STATUS_TEXT[status]}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "navy" | "intake" | "output" | "amber" | "alert";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-fog-100 text-fog-700",
    navy: "bg-navy-900/5 text-navy-800",
    intake: "bg-intake-100 text-intake-700",
    output: "bg-output-100 text-output-700",
    amber: "bg-amber-100 text-amber-700",
    alert: "bg-alert-100 text-alert-600",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
