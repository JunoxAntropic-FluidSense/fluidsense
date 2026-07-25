import { cn } from "@/lib/cn";

/**
 * Layout-only bento grid container, adapted from Aceternity's bento-grid
 * (https://ui.aceternity.com/components/bento-grid). Unlike the original,
 * this drops the fixed `auto-rows` sizing and the title/icon/description
 * slot shape in BentoGridItem — FluidSense's cards (BalanceCard,
 * AllowanceCard, etc.) already own their internal layout and vary in
 * height, so items just size cells with `col-span-*`/`row-span-*` and
 * render their own content.
 */
export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2", className)}>
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  title,
  description,
  header,
  icon,
}: {
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "group/bento flex flex-col justify-between gap-4 rounded-3xl border border-fog-200 bg-white p-4 transition duration-200",
        className
      )}
    >
      {header}
      <div className="transition duration-200 group-hover/bento:translate-x-1">
        {icon}
        <div className="mt-2 mb-2 font-sans font-bold text-navy-900">
          {title}
        </div>
        <div className="font-sans text-xs font-normal text-fog-600">
          {description}
        </div>
      </div>
    </div>
  );
};
