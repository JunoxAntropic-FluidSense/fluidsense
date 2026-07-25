import { useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * Grid where hovering one item focuses it and blurs its siblings — adapted
 * from Aceternity's focus-cards (src/components/ui/focus-cards.tsx), which
 * assumes image-backed cards. This version is generic: each item renders its
 * own content (e.g. an existing <Card>), so status pills / reliability
 * badges inside keep rendering unchanged.
 */
export function FocusCardGrid({
  children,
  className = "",
}: {
  children: ReactNode[];
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className={cn("grid gap-4 md:grid-cols-2", className)}>
      {children.map((child, index) => (
        <div
          key={index}
          onMouseEnter={() => setHovered(index)}
          onMouseLeave={() => setHovered(null)}
          className={`transition-all duration-300 ease-out ${
            hovered !== null && hovered !== index
              ? "opacity-60 blur-[1px] scale-[0.99]"
              : ""
          }`}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
