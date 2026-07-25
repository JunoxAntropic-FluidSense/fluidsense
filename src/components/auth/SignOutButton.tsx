// Self-contained sign-out control. Renders its own error banner on failure
// rather than throwing — callers only need to handle the happy path via
// onSignOut (routing back to a signed-out screen is Issue 4's job).

import { useState } from "react";
import type { ReactNode } from "react";
import { signOut } from "../../lib/supabase/auth";
import { Button } from "../ui/Button";

type ButtonVariant = "primary" | "secondary" | "ghost" | "output" | "danger";
type ButtonSize = "md" | "lg" | "xl";

export interface SignOutButtonProps {
  /** Called after a successful sign-out. */
  onSignOut?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: ReactNode;
}

export function SignOutButton({
  onSignOut,
  variant = "secondary",
  size = "md",
  className = "",
  children = "Sign out",
}: SignOutButtonProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await signOut();
      if (result.error) {
        setError(result.error.message);
        return;
      }
      onSignOut?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={submitting}
        onClick={handleClick}
      >
        {submitting ? "Signing out…" : children}
      </Button>
      {error && (
        <div className="mt-2 rounded-xl border border-alert-100 bg-alert-50 p-3">
          <p className="text-sm text-alert-600 font-semibold">{error}</p>
        </div>
      )}
    </div>
  );
}
