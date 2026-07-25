import { format } from "date-fns";
import type { FluidEvent } from "../types";
import { StatusBadge } from "./ui/Badge";
import { PhotoThumbnail } from "./PhotoThumbnail";
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  INPUT_METHOD_LABEL,
  INPUT_METHOD_ICON,
} from "../lib/eventMeta";

export function EventRow({
  event,
  onEdit,
  selectable,
  selected,
  onToggleSelect,
}: {
  event: FluidEvent;
  onEdit?: (e: FluidEvent) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const isIntake = event.direction === "intake";
  return (
    <li className="flex items-start gap-3 py-3 border-b border-navy-900/5 last:border-0">
      {selectable && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect?.(event.id)}
          aria-label={`Select entry: ${event.category}`}
          className="mt-2 w-5 h-5 shrink-0"
        />
      )}
      <span
        className={`flex items-center justify-center w-10 h-10 rounded-full text-lg shrink-0 ${isIntake ? "bg-intake-50" : "bg-output-50"}`}
        aria-hidden="true"
      >
        {CATEGORY_ICON[event.category]}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-navy-900">
            {CATEGORY_LABEL[event.category]}
          </span>
          <StatusBadge status={event.status} />
          {event.edited && (
            <span className="text-xs text-fog-500">(edited)</span>
          )}
        </div>
        <p className="text-sm text-fog-600 mt-0.5">
          {event.amountMl != null
            ? `${Math.round(event.amountMl)} mL`
            : "No volume recorded"}
          {event.episodeCount
            ? ` · ${event.episodeCount} episode${event.episodeCount > 1 ? "s" : ""}`
            : ""}
          {event.subtype ? ` · ${event.subtype.replace(/_/g, " ")}` : ""}
        </p>
        <p className="text-xs text-fog-500 mt-1">
          {format(new Date(event.eventTime), "d MMM, HH:mm")} ·{" "}
          {event.enteredBy} ·{" "}
          <span aria-hidden="true">{INPUT_METHOD_ICON[event.inputMethod]}</span>{" "}
          {INPUT_METHOD_LABEL[event.inputMethod]}
        </p>
        {event.note && (
          <p className="text-xs text-fog-600 mt-1 italic">"{event.note}"</p>
        )}
        {event.photoStoragePath && (
          <div className="mt-1.5">
            <PhotoThumbnail
              path={event.photoStoragePath}
              size="sm"
              alt={`Photo attached to ${CATEGORY_LABEL[event.category]} entry`}
            />
          </div>
        )}
      </div>
      {onEdit && (
        <button
          onClick={() => onEdit(event)}
          className="shrink-0 text-sm font-semibold text-intake-600 hover:text-intake-700 min-h-11 px-2"
          aria-label={`Edit ${CATEGORY_LABEL[event.category]} entry`}
        >
          Edit
        </button>
      )}
    </li>
  );
}
