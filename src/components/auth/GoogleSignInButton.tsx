// "Continue with Google" — redirects to Google's consent screen and back.
// Unlike EmailPasswordForm/MagicLinkForm, a resolved promise here does not
// mean signed in: success navigates the browser away before this component
// unmounts, and the actual session is only established once the redirect
// back completes on AuthCallbackPage (see signInWithGoogle's doc comment).
// There is deliberately no onSuccess prop — there is nothing to call it with.

import { useState } from "react";
import { IconBrandGoogle } from "@tabler/icons-react";
import { signInWithGoogle } from "../../lib/supabase/auth";
import { useAuthStore } from "../../store/useAuthStore";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";

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
        icon={<IconBrandGoogle size={18} aria-hidden="true" />}
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
