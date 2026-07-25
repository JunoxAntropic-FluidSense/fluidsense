// Passwordless sign-in via a one-time emailed link. This only sends the link
// — it does not (and cannot) produce a session synchronously, so onSuccess
// here means "the email was sent", not "the user is signed in."

import { useState } from "react";
import type { FormEvent } from "react";
import { signInWithMagicLink } from "../../lib/supabase/auth";
import { useAuthStore } from "../../store/useAuthStore";
import { Button } from "../ui/Button";

export interface MagicLinkFormProps {
  /** Called once the magic-link email has been sent successfully. */
  onSuccess?: () => void;
  /** Passed through to Supabase as the link's redirect target, if provided. */
  redirectTo?: string;
  className?: string;
}

export function MagicLinkForm({
  onSuccess,
  redirectTo,
  className = "",
}: MagicLinkFormProps) {
  const authStatus = useAuthStore((state) => state.status);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const busy = submitting || authStatus === "loading";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signInWithMagicLink(email, redirectTo);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setSent(true);
      onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div
        className={`rounded-xl border border-navy-900/15 bg-fog-50 p-3 ${className}`}
      >
        <p className="text-sm text-navy-700 font-semibold">
          Link sent — check {email} for a sign-in link.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <label className="block text-sm font-semibold text-navy-700">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={busy}
          className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal disabled:opacity-60"
        />
      </label>

      {error && (
        <div className="rounded-xl border border-alert-100 bg-alert-50 p-3">
          <p className="text-sm text-alert-600 font-semibold">{error}</p>
        </div>
      )}

      <Button type="submit" variant="secondary" fullWidth disabled={busy}>
        {busy ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
