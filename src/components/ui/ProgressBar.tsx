export function ProgressBar({
  value,
  max,
  tone = "intake",
}: {
  value: number;
  max: number;
  tone?: "intake" | "amber" | "alert";
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  const over = value > max;
  const colors = over
    ? "bg-alert-500"
    : tone === "amber"
      ? "bg-amber-500"
      : "bg-intake-600";
  return (
    <div
      className="w-full h-3 rounded-full bg-fog-100 overflow-hidden"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={`h-full rounded-full ${colors} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
