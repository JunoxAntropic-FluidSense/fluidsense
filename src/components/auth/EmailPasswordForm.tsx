// Email + password sign-up / sign-in form. Presentational and self-contained —
// callers decide what happens next via onSuccess (routing/wiring is Issue 4's
// job, not this component's).

import { useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  signInWithPassword,
  signUpWithPassword,
} from "../../lib/supabase/auth";
import { useAuthStore } from "../../store/useAuthStore";
import { Button } from "../ui/Button";
import { Field, Input } from "../ui/Field";

export type EmailPasswordMode = "sign-in" | "sign-up";

export interface EmailPasswordFormProps {
  /** Which action the form performs on submit. Defaults to "sign-in". */
  mode?: EmailPasswordMode;
  /** Called once sign-in/sign-up succeeds and a session exists. */
  onSuccess?: (session: Session) => void;
  className?: string;
}

export function EmailPasswordForm({
  mode = "sign-in",
  onSuccess,
  className = "",
}: EmailPasswordFormProps) {
  const authStatus = useAuthStore((state) => state.status);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = submitting || authStatus === "loading";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result =
        mode === "sign-up"
          ? await signUpWithPassword(email, password)
          : await signInWithPassword(email, password);

      if (result.error) {
        setError(result.error.message);
        return;
      }
      if (result.session) {
        onSuccess?.(result.session);
      } else {
        // Sign-up with email confirmation enabled returns no session yet.
        setError("Check your email to confirm your account before signing in.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <Field label="Email">
        <Input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={busy}
        />
      </Field>
      <Field label="Password">
        <Input
          type="password"
          required
          minLength={8}
          autoComplete={
            mode === "sign-up" ? "new-password" : "current-password"
          }
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          disabled={busy}
        />
      </Field>

      {error && (
        <div className="rounded-xl border border-alert-100 bg-alert-50 p-3">
          <p className="text-sm text-alert-600 font-semibold">{error}</p>
        </div>
      )}

      <Button type="submit" fullWidth disabled={busy}>
        {busy
          ? "Please wait…"
          : mode === "sign-up"
            ? "Create account"
            : "Sign in"}
      </Button>
    </form>
  );
}
