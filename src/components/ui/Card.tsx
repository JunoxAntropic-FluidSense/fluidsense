import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={`rounded-3xl bg-white border border-navy-900/5 shadow-[0_1px_2px_rgba(15,51,65,0.06),0_8px_24px_-16px_rgba(15,51,65,0.16)] ${className}`}
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
