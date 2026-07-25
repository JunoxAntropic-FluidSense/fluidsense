import { Link } from "react-router-dom";

export function AddPage() {
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-extrabold text-navy-900">Add an entry</h1>
      <p className="text-sm text-fog-600">
        Choose what you'd like to record, or use voice entry for a faster
        option.
      </p>

      <Link
        to="/add/intake"
        className="block rounded-3xl bg-intake-600 text-white p-6 hover:bg-intake-700"
      >
        <span className="text-3xl" aria-hidden="true">
          💧
        </span>
        <h2 className="text-xl font-extrabold mt-2">Record intake</h2>
        <p className="text-sm text-intake-50/90">
          Drinks, IV fluids, feeds and more
        </p>
      </Link>

      <Link
        to="/add/output"
        className="block rounded-3xl bg-output-600 text-white p-6 hover:bg-output-700"
      >
        <span className="text-3xl" aria-hidden="true">
          🚻
        </span>
        <h2 className="text-xl font-extrabold mt-2">Record output or loss</h2>
        <p className="text-sm text-output-50/90">
          Urine, vomiting, diarrhoea, sweating and more
        </p>
      </Link>

      <Link
        to="/voice"
        className="block rounded-3xl bg-white border-2 border-navy-900/10 p-6 hover:border-intake-400"
      >
        <span className="text-3xl" aria-hidden="true">
          🎙️
        </span>
        <h2 className="text-xl font-extrabold text-navy-900 mt-2">
          Speak an entry
        </h2>
        <p className="text-sm text-fog-600">
          Describe what happened in your own words
        </p>
      </Link>
    </div>
  );
}
