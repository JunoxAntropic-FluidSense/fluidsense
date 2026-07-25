import { motion } from "motion/react";
import { useId } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { cn } from "../../lib/cn";

/**
 * Segmented control for small, fixed option sets — a flatter alternative to
 * a <select> for choices like direction/status filters or a sort order.
 * Adapted from Aceternity's animated tabs (src/components/ui/tabs.tsx): same
 * sliding-pill technique (motion layoutId), but without that component's
 * content-switching/card-stack behavior, which doesn't fit a filter control.
 */
export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  className = "",
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  label?: string;
}) {
  const layoutId = useId();
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-2xl bg-fog-100 p-1.5 max-w-full",
        className
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className="relative shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold"
          >
            {isActive && (
              <motion.div
                layoutId={`${layoutId}-active-pill`}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", bounce: 0.25, duration: 0.4 }
                }
                className="absolute inset-0 rounded-full bg-white shadow-[0_1px_2px_rgba(20,20,20,0.08),0_1px_4px_-2px_rgba(20,20,20,0.16)]"
              />
            )}
            <span
              className={`relative ${isActive ? "text-navy-900" : "text-fog-600"}`}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
