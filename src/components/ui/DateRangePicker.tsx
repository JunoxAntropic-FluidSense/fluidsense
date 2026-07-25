import { useEffect, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { format } from "date-fns";
import { Button } from "./Button";

export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: Date | undefined;
  to: Date | undefined;
  onChange: (range: { from: Date | undefined; to: Date | undefined }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(
    from || to ? { from, to } : undefined
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(from || to ? { from, to } : undefined);
    const onPointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const label =
    from && to
      ? `${format(from, "d MMM yyyy")} – ${format(to, "d MMM yyyy")}`
      : from
        ? `From ${format(from, "d MMM yyyy")}`
        : "Select dates";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="w-full text-left rounded-xl border border-navy-900/15 px-3 py-2 text-sm font-normal bg-white"
      >
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Select date range"
          className="fluidsense-daypicker absolute z-30 mt-2 rounded-2xl border border-navy-900/10 bg-white p-3 shadow-lg"
          style={
            {
              "--rdp-accent-color": "var(--color-intake-600)",
              "--rdp-accent-background-color": "var(--color-intake-50)",
              "--rdp-today-color": "var(--color-intake-700)",
            } as React.CSSProperties
          }
        >
          <DayPicker
            mode="range"
            selected={draft}
            onSelect={setDraft}
            numberOfMonths={1}
          />
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-navy-900/10">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setDraft(undefined);
                onChange({ from: undefined, to: undefined });
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <Button
              size="md"
              disabled={!draft?.from}
              onClick={() => {
                onChange({ from: draft?.from, to: draft?.to ?? draft?.from });
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
