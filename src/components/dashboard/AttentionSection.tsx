import { useState } from "react";
import { Card, CardHeading } from "../ui/Card";
import { Button } from "../ui/Button";
import type { PatientProfile } from "../../types";

export interface AttentionCategory {
  key: string;
  label: string;
  description: string;
  patients: PatientProfile[];
}

// Category labels/descriptions describe recorded-data gaps only (documented
// completeness, missed appointments as logged) — never a clinical judgment
// about a patient's condition. See CLAUDE.md hard rule 2.
export function AttentionSection({
  categories,
  onOpenPatient,
}: {
  categories: AttentionCategory[];
  onOpenPatient: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const nonEmpty = categories.filter((c) => c.patients.length > 0);

  if (nonEmpty.length === 0) {
    return (
      <Card className="p-5">
        <CardHeading>Needs attention</CardHeading>
        <p className="text-sm text-fog-600">
          Nothing flagged right now — every patient's recorded data looks
          complete.
        </p>
      </Card>
    );
  }

  const activeCategory = nonEmpty.find((c) => c.key === expanded) ?? null;

  return (
    <Card className="p-5">
      <CardHeading>Needs attention</CardHeading>
      <p className="text-xs text-fog-500 mb-3">
        Grouped by recorded-data gaps, not clinical judgment — open a group to
        see who's affected.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {nonEmpty.map((c) => (
          <button
            key={c.key}
            onClick={() => setExpanded(c.key)}
            className="text-left rounded-2xl border border-navy-900/10 bg-white p-4 hover:border-alert-500 hover:bg-alert-50"
          >
            <p className="text-2xl font-extrabold text-navy-900">
              {c.patients.length}
            </p>
            <p className="text-sm font-semibold text-navy-800">{c.label}</p>
          </button>
        ))}
      </div>

      {activeCategory && (
        <div
          className="fixed inset-0 z-40 flex items-end md:items-center md:justify-center bg-navy-950/40"
          role="dialog"
          aria-modal="true"
          aria-label={activeCategory.label}
        >
          <div className="bg-white w-full md:max-w-lg md:rounded-3xl rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-extrabold text-navy-900 mb-1">
              {activeCategory.label}
            </h2>
            <p className="text-xs text-fog-500 mb-4">
              {activeCategory.description}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-fog-500 border-b border-navy-900/10">
                  <th className="pb-2 font-semibold">Patient</th>
                  <th className="pb-2 font-semibold">Care setting</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {activeCategory.patients.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-navy-900/5 last:border-0"
                  >
                    <td className="py-2.5 font-semibold text-navy-800">
                      {p.displayName}
                    </td>
                    <td className="py-2.5 text-fog-600">{p.careSetting}</td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => {
                          onOpenPatient(p.id);
                          setExpanded(null);
                        }}
                        className="text-xs font-bold text-intake-700 underline hover:no-underline"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button
              fullWidth
              variant="secondary"
              className="mt-4"
              onClick={() => setExpanded(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
