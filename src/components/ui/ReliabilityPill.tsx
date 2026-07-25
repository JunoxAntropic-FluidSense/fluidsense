import type { ReliabilityLevel } from "../../types";
import { cn } from "../../lib/cn";

const STYLE: Record<ReliabilityLevel, string> = {
  High: "bg-intake-100 text-intake-700 border-intake-200",
  Moderate: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-alert-100 text-alert-600 border-alert-100",
};

const ICON: Record<ReliabilityLevel, string> = {
  High: "●",
  Moderate: "◐",
  Low: "○",
};

export function ReliabilityPill({
  level,
  className = "",
}: {
  level: ReliabilityLevel;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold",
        STYLE[level],
        className
      )}
    >
      <span aria-hidden="true">{ICON[level]}</span>
      Reliability: {level}
    </span>
  );
}
