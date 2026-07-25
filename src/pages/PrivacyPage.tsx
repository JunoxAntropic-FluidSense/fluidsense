import { Link } from "react-router-dom";
import { PrototypeBanner } from "../components/ui/PrototypeBanner";

export function PrivacyPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-fog-50">
      <PrototypeBanner />
      <div className="max-w-2xl mx-auto w-full px-6 py-8 space-y-4">
        <Link to="/welcome" className="text-sm font-semibold text-intake-600">
          ← Back
        </Link>
        <h1 className="text-2xl font-extrabold text-navy-900">Privacy</h1>
        <p className="text-sm text-fog-600">
          This is a prototype. Here's exactly what FluidSense does and doesn't
          do with your data.
        </p>

        <section className="space-y-2">
          <h2 className="font-bold text-navy-900">What's stored</h2>
          <p className="text-sm text-fog-700">
            Your fluid entries, saved drinks, containers, reminders and profile
            settings are stored on this device (in your browser's local
            storage), or in a database you control if a backend has been
            configured for this deployment. FluidSense does not connect to any
            real clinical record system.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-navy-900">Voice data</h2>
          <p className="text-sm text-fog-700">
            When you use voice entry, your microphone audio is recorded only
            while you're actively speaking (never continuous listening), used
            once to produce a text transcript, and then discarded — raw audio is
            never permanently stored. You can choose in Profile whether the text
            transcript itself is kept alongside a saved entry.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-navy-900">Demo mode</h2>
          <p className="text-sm text-fog-700">
            Demo mode uses entirely fictional patients and fictional data,
            generated locally. It is never mixed with, or written into, your
            real account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-navy-900">Deleting your data</h2>
          <p className="text-sm text-fog-700">
            Data and monitoring settings (reachable from Profile) let you clear
            a single day, delete all fluid data, or reset your account entirely
            — all from within the app, at any time.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-navy-900">No real patient data</h2>
          <p className="text-sm text-fog-700">
            Do not enter NHS numbers, hospital numbers, real names, dates of
            birth, addresses, or any other real patient-identifiable information
            into this prototype.
          </p>
        </section>
      </div>
    </div>
  );
}
