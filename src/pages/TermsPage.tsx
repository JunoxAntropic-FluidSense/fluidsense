import { Link } from "react-router-dom";
import { PrototypeBanner } from "../components/ui/PrototypeBanner";

export function TermsPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-fog-50">
      <PrototypeBanner />
      <div className="max-w-2xl mx-auto w-full px-6 py-8 space-y-4">
        <Link to="/welcome" className="text-sm font-semibold text-intake-600">
          ← Back
        </Link>
        <h1 className="text-2xl font-extrabold text-navy-900">Terms</h1>
        <p className="text-sm text-fog-600">
          Placeholder terms for this prototype — not a final legal document.
        </p>

        <section className="space-y-2">
          <h2 className="font-bold text-navy-900">Prototype status</h2>
          <p className="text-sm text-fog-700">
            FluidSense is currently a prototype and must not be used as the sole
            basis for clinical decisions. It has not been through clinical
            safety certification and carries no warranty of accuracy or fitness
            for any particular purpose.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-navy-900">
            No diagnostic or treatment advice
          </h2>
          <p className="text-sm text-fog-700">
            FluidSense records fluid events and summarises the information
            entered. It does not diagnose conditions, does not recommend
            treatment, and does not determine a patient's true fluid status.
            Clinical decisions should always follow a patient's existing care
            plan and qualified clinical judgement.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-navy-900">Fictional data only</h2>
          <p className="text-sm text-fog-700">
            Demo mode and any sample data in this deployment are entirely
            fictional. Do not enter real patient-identifiable information into
            this prototype.
          </p>
        </section>
      </div>
    </div>
  );
}
