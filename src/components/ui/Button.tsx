import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "output" | "danger";
type Size = "md" | "lg" | "xl";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-fern-500 text-white hover:bg-fern-600 active:bg-fern-700 shadow-sm shadow-fern-500/10",
  secondary: "bg-white text-navy-800 border border-navy-900/15 hover:bg-fog-50",
  output: "bg-output-600 text-white hover:bg-output-700 active:bg-output-700",
  ghost: "bg-transparent text-navy-700 hover:bg-fog-100",
  danger: "bg-alert-500 text-white hover:bg-alert-600",
};

const SIZE_CLASSES: Record<Size, string> = {
  md: "min-h-11 px-5 text-sm rounded-full",
  lg: "min-h-14 px-6 text-base rounded-full",
  xl: "min-h-20 px-6 text-lg rounded-full",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "lg",
      icon,
      fullWidth,
      className = "",
      children,
      ...rest
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold cursor-pointer transition-colors duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          fullWidth && "w-full",
          className
        )}
        {...rest}
      >
        {icon}
        {children}
      </button>
    );
  }
);
