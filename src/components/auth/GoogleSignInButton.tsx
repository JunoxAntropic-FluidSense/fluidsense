// "Continue with Google" — redirects to Google's consent screen and back.
// Unlike EmailPasswordForm/MagicLinkForm, a resolved promise here does not
// mean signed in: success navigates the browser away before this component
// unmounts, and the actual session is only established once the redirect
// back completes on AuthCallbackPage (see signInWithGoogle's doc comment).
// There is deliberately no onSuccess prop — there is nothing to call it with.

import { useState } from "react";
import { signInWithGoogle } from "../../lib/supabase/auth";
import { useAuthStore } from "../../store/useAuthStore";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export interface GoogleSignInButtonProps {
  /** Passed through to Supabase as the OAuth redirect target, if provided. */
  redirectTo?: string;
  className?: string;
}

export function GoogleSignInButton({
  redirectTo,
  className,
}: GoogleSignInButtonProps) {
  const authStatus = useAuthStore((state) => state.status);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = submitting || authStatus === "loading";

  async function handleClick() {
    setError(null);
    setSubmitting(true);
    const result = await signInWithGoogle(redirectTo);
    // Only reached on failure — a successful call already navigated away.
    setSubmitting(false);
    if (result.error) setError(result.error.message);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        variant="secondary"
        fullWidth
        disabled={busy}
        onClick={handleClick}
        icon={<GoogleIcon />}
      >
        {busy ? "Redirecting…" : "Continue with Google"}
      </Button>
      {error && (
        <div className="rounded-xl border border-alert-100 bg-alert-50 p-3">
          <p className="text-sm text-alert-600 font-semibold">{error}</p>
        </div>
      )}
    </div>
  );
}
