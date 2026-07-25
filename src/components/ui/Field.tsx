import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { forwardRef } from "react";

/** Label + optional hint wrapper for a single form field, left-aligned per Reverie. */
export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-1.5 text-left ${className}`}>
      <span className="text-sm font-semibold text-navy-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-fog-500">{hint}</span>}
    </label>
  );
}

const fieldBase =
  "w-full bg-white border border-navy-900/15 text-navy-900 font-normal transition-colors focus:outline-none focus:border-fern-500 focus:ring-2 focus:ring-fern-500/20 disabled:opacity-50";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = "", ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={`${fieldBase} rounded-full px-4 py-2.5 ${className}`}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className = "", ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={`${fieldBase} rounded-full px-4 py-2.5 ${className}`}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={`${fieldBase} rounded-2xl px-4 py-3 resize-y min-h-24 ${className}`}
      {...rest}
    />
  );
});
