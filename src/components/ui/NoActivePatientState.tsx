import { useNavigate } from "react-router-dom";
import { Card } from "./Card";
import { Button } from "./Button";

/**
 * Shown instead of a blank page on any patient-scoped route (Today, Voice,
 * History, Summary, Drinks, etc.) when a healthcare account has zero
 * patients yet — matches DashboardPage's own empty state: a blurred,
 * non-interactive generic mock behind the real "Add patient" CTA, rather
 * than a bare page. Placeholder shapes only, never real or demo data.
 */
export function NoActivePatientState() {
  const navigate = useNavigate();

  return (
    <div className="relative max-w-lg mx-auto">
      <div
        aria-hidden="true"
        className="pointer-events-none select-none blur-sm opacity-50 space-y-4"
      >
        <div className="h-8 w-40 rounded-lg bg-navy-900/10" />
        <Card className="p-5 space-y-3">
          <div className="h-4 w-24 rounded bg-navy-900/10" />
          <div className="h-8 w-full rounded-xl bg-fog-100" />
          <div className="h-8 w-full rounded-xl bg-fog-100" />
        </Card>
        <Card className="p-5 space-y-3">
          <div className="h-4 w-32 rounded bg-navy-900/10" />
          <div className="h-20 w-full rounded-xl bg-fog-100" />
        </Card>
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <Card className="p-6 text-center space-y-3 shadow-xl max-w-sm w-full">
          <p className="font-bold text-navy-900 text-lg">No patient selected</p>
          <p className="text-sm text-fog-600">
            Add your first patient to start recording and reviewing their fluid
            data.
          </p>
          <Button
            fullWidth
            onClick={() => navigate("/dashboard?addPatient=true")}
          >
            Add patient
          </Button>
        </Card>
      </div>
    </div>
  );
}
