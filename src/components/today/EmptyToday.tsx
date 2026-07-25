import { Drop } from "@phosphor-icons/react";
import { Card } from "../ui/Card";

/**
 * Deliberately has no buttons of its own — the "Speak an entry" FAB and the
 * Quick add grid below already cover every way to log an entry. Repeating
 * those actions a third time here is what made the empty state feel like a
 * wall of competing buttons with no clear next step.
 */
export function EmptyToday() {
  return (
    <Card className="p-6 text-center space-y-2">
      <Drop
        size={28}
        weight="fill"
        className="mx-auto text-intake-500"
        aria-hidden="true"
      />
      <div>
        <h2 className="text-base font-extrabold text-navy-900">
          No fluid events recorded yet
        </h2>
        <p className="text-sm text-fog-600 mt-1">
          Tap Speak an entry or a quick-add button below.
        </p>
      </div>
    </Card>
  );
}
