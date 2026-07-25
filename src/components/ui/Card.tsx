import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={`rounded-3xl bg-white border border-fog-200 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeading({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-bold text-navy-900">{children}</h2>
      {action}
    </div>
  );
}
