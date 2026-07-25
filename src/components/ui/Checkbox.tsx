import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";
import { Check } from "@phosphor-icons/react";

/** Rounded-square checkbox, drop-in replacement for a raw <input type="checkbox">. */
export const Checkbox = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Checkbox({ className = "", ...rest }, ref) {
  return (
    <span className="relative inline-flex h-5 w-5 shrink-0">
      <input
        ref={ref}
        type="checkbox"
        className={`peer h-5 w-5 appearance-none rounded-md border border-navy-900/20 bg-white transition-colors checked:border-fern-500 checked:bg-fern-500 cursor-pointer ${className}`}
        {...rest}
      />
      <Check
        size={12}
        weight="bold"
        className="pointer-events-none absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
});

/** Pill switch, drop-in replacement for a raw <input type="checkbox"> used as a toggle. */
export const Switch = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Switch({ className = "", ...rest }, ref) {
  return (
    <span className="relative inline-flex h-6 w-[42px] shrink-0">
      <input
        ref={ref}
        type="checkbox"
        className={`peer h-6 w-[42px] appearance-none rounded-full bg-fog-300 transition-colors checked:bg-fern-500 cursor-pointer ${className}`}
        {...rest}
      />
      <span className="pointer-events-none absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-[18px]" />
    </span>
  );
});
