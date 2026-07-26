import { useState } from "react";
import { format } from "date-fns";
import { UserCheck, UserMinus } from "@phosphor-icons/react";
import { Card, CardHeading } from "../ui/Card";
import { EventRow } from "../EventRow";
import { EditEventModal } from "../EditEventModal";
import type { FluidEvent, CheckInEvent } from "../../types";

type TimelineItem =
  | { type: "fluid"; id: string; time: Date; data: FluidEvent }
  | { type: "check"; id: string; time: Date; data: CheckInEvent };

export function ActivityTimeline({
  fluidEvents,
  checkInEvents = [],
}: {
  fluidEvents: FluidEvent[];
  checkInEvents?: CheckInEvent[];
}) {
  const [editing, setEditing] = useState<FluidEvent | null>(null);

  const items: TimelineItem[] = [
    ...fluidEvents.map((e) => ({
      type: "fluid" as const,
      id: e.id,
      time: new Date(e.eventTime),
      data: e,
    })),
    ...checkInEvents.map((e) => ({
      type: "check" as const,
      id: e.id,
      time: new Date(e.timestamp),
      data: e,
    })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime());

  return (
    <Card className="p-5">
      <CardHeading>Recent activity</CardHeading>
      {items.length === 0 ? (
        <p className="text-sm text-fog-600">No entries yet in this period.</p>
      ) : (
        <ul className="divide-y divide-navy-900/5">
          {items.slice(0, 12).map((item) => {
            if (item.type === "fluid") {
              return (
                <EventRow key={item.id} event={item.data} onEdit={setEditing} />
              );
            }

            const checkEvent = item.data;
            const isCheckIn = checkEvent.type === "check_in";

            return (
              <li
                key={item.id}
                className="flex items-start gap-3 py-3 last:border-b-0"
              >
                <span
                  className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${
                    isCheckIn
                      ? "bg-intake-50 text-intake-700"
                      : "bg-fog-100 text-fog-600"
                  }`}
                  aria-hidden="true"
                >
                  {isCheckIn ? (
                    <UserCheck size={20} weight="fill" />
                  ) : (
                    <UserMinus size={20} weight="fill" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-navy-900">
                      {isCheckIn ? "Clinician Check-in" : "Clinician Check-out"}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isCheckIn
                          ? "bg-intake-100 text-intake-800"
                          : "bg-fog-200 text-fog-800"
                      }`}
                    >
                      {isCheckIn ? "Active" : "Completed"}
                    </span>
                  </div>
                  <p className="text-sm text-fog-700 mt-0.5">
                    {checkEvent.clinicianName}{" "}
                    {isCheckIn
                      ? "checked in to patient"
                      : "checked out from patient"}
                    .
                  </p>
                  <p className="text-xs text-fog-500 mt-1">
                    {format(item.time, "d MMM, HH:mm")}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && (
        <EditEventModal event={editing} onClose={() => setEditing(null)} />
      )}
    </Card>
  );
}
