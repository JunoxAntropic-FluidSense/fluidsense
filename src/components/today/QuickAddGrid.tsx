import { useState } from "react";
import { CardHeading, Card } from "../ui/Card";
import { CategoryIcon } from "../../lib/eventMeta";
import type { PatientProfile } from "../../types";
import { QuickAddSheet } from "./QuickAddSheet";

export function QuickAddGrid({ patient }: { patient: PatientProfile }) {
  const [active, setActive] = useState<{
    kind: "intake" | "output";
    category: string;
    label: string;
  } | null>(null);
  const intakeButtons = patient.quickButtons
    .filter((q) => q.kind === "intake" && q.enabled)
    .sort((a, b) => a.order - b.order);
  const outputButtons = patient.quickButtons
    .filter((q) => q.kind === "output" && q.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <CardHeading>Quick add — intake</CardHeading>
          <div className="grid grid-cols-3 gap-2.5">
            {intakeButtons.map((b) => (
              <button
                key={b.id}
                onClick={() =>
                  setActive({
                    kind: "intake",
                    category: b.category,
                    label: b.label,
                  })
                }
                className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-intake-50 border border-intake-100 py-3.5 min-h-20 hover:bg-intake-100 active:scale-[0.98]"
              >
                <CategoryIcon
                  category={b.category}
                  size={22}
                  className="text-intake-700"
                  aria-hidden="true"
                />
                <span className="text-xs font-bold text-intake-700 text-center leading-tight">
                  {b.label}
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <CardHeading>Quick add — output</CardHeading>
          <div className="grid grid-cols-3 gap-2.5">
            {outputButtons.map((b) => (
              <button
                key={b.id}
                onClick={() =>
                  setActive({
                    kind: "output",
                    category: b.category,
                    label: b.label,
                  })
                }
                className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-output-50 border border-output-100 py-3.5 min-h-20 hover:bg-output-100 active:scale-[0.98]"
              >
                <CategoryIcon
                  category={b.category}
                  size={22}
                  className="text-output-700"
                  aria-hidden="true"
                />
                <span className="text-xs font-bold text-output-700 text-center leading-tight">
                  {b.label}
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {active && (
        <QuickAddSheet
          kind={active.kind}
          category={active.category as never}
          label={active.label}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
