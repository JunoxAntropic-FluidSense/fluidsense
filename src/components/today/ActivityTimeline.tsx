import { useState } from "react";
import { Card, CardHeading } from "../ui/Card";
import { EventRow } from "../EventRow";
import { EditEventModal } from "../EditEventModal";
import type { FluidEvent } from "../../types";

export function ActivityTimeline({ events }: { events: FluidEvent[] }) {
  const [editing, setEditing] = useState<FluidEvent | null>(null);
  return (
    <Card className="p-5">
      <CardHeading>Recent activity</CardHeading>
      {events.length === 0 ? (
        <p className="text-sm text-fog-600">No entries yet in this period.</p>
      ) : (
        <ul>
          {events.slice(0, 12).map((e) => (
            <EventRow key={e.id} event={e} onEdit={setEditing} />
          ))}
        </ul>
      )}
      {editing && (
        <EditEventModal event={editing} onClose={() => setEditing(null)} />
      )}
    </Card>
  );
}
