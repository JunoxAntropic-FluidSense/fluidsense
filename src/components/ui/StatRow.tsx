type Tone = "intake" | "output" | "navy" | "fog" | "alert";

const TONE_CLASS: Record<Tone, string> = {
  intake: "text-intake-700",
  output: "text-output-700",
  navy: "text-navy-900",
  fog: "text-fog-600",
  alert: "text-alert-600",
};

export function StatRow({
  label,
  value,
  tone = "navy",
  strong,
  dense,
}: {
  label: string;
  value: string;
  tone?: Tone;
  /** Emphasise this row above its siblings (larger, bolder value). */
  strong?: boolean;
  /** Tighter, lighter-weight styling for rows packed into a dense list (e.g. dashboard patient cards). */
  dense?: boolean;
}) {
  const valueSize = strong
    ? "text-xl font-bold"
    : dense
      ? "text-sm font-semibold"
      : "text-base font-bold";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-fog-600">{label}</dt>
      <dd className={`text-right ${valueSize} ${TONE_CLASS[tone]}`}>{value}</dd>
    </div>
  );
}
