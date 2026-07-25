import { useNavigate } from "react-router-dom";
import { Card, CardHeading } from "../ui/Card";
import { useFluidData } from "../../hooks/useFluidData";
import { getCheckInStatuses } from "../../lib/checkins";
import type { CheckInStatus, CheckInWindowStatus } from "../../lib/checkins";

const DOT_CLASS: Record<CheckInStatus, string> = {
  done: "bg-intake-600",
  current: "bg-navy-800",
  missed: "bg-amber-500",
  upcoming: "bg-fog-300",
};

const ROW_CLASS: Record<CheckInStatus, string> = {
  done: "bg-fog-50",
  current: "bg-navy-900/5 ring-1 ring-navy-900/10",
  missed: "bg-amber-50",
  upcoming: "bg-fog-50",
};

function statusText(s: CheckInWindowStatus): string {
  const lower = s.label.toLowerCase();
  switch (s.status) {
    case "done":
      return `${s.label} check-in logged`;
    case "current":
      return `No entries logged yet this ${lower}`;
    case "missed":
      return `No entries were logged this ${lower}`;
    case "upcoming":
      return `${s.label} check-in coming up`;
  }
}

/** Check-in status rows with no Card wrapper, for embedding inside another card (see TodayContextCard). */
export function CheckInStatusList() {
  const navigate = useNavigate();
  const { patient, windowEvents } = useFluidData("since_midnight");

  if (!patient) return null;

  const statuses = getCheckInStatuses(windowEvents, new Date());

  return (
    <div className="space-y-2">
      {statuses.map((s) => {
        const actionable = s.status !== "done";
        const row = (
          <div
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left ${ROW_CLASS[s.status]}`}
          >
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[s.status]}`}
            />
            <span className="flex-1 text-sm font-semibold text-navy-900">
              {s.label}
            </span>
            <span className="text-sm text-fog-600">{statusText(s)}</span>
          </div>
        );

        return actionable ? (
          <button
            key={s.window}
            type="button"
            onClick={() => navigate("/voice")}
            className="w-full cursor-pointer transition-opacity hover:opacity-80"
          >
            {row}
          </button>
        ) : (
          <div key={s.window}>{row}</div>
        );
      })}
    </div>
  );
}

export function CheckInCard() {
  return (
    <Card className="p-5">
      <CardHeading>Check-ins today</CardHeading>
      <CheckInStatusList />
    </Card>
  );
}
