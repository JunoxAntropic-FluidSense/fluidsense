// Typed auth wrappers around supabase-js v2. Every function here returns a
// normalized result shape — never a raw Supabase AuthError — so callers never
// need to know about supabase-js's error type. When no backend is configured
// (see ./client.ts), calls resolve to a "not configured" error instead of
// throwing, per CLAUDE.md's "backend is optional" rule.

import type { EmailOtpType, Session, User } from "@supabase/supabase-js";
import { supabase } from "./client";

export interface NormalizedAuthError {
  message: string;
}

export interface AuthResult {
  error: NormalizedAuthError | null;
}

export interface AuthSessionResult extends AuthResult {
  user: User | null;
  session: Session | null;
}

const NOT_CONFIGURED_ERROR: NormalizedAuthError = {
  message: "Supabase is not configured.",
};

const GENERIC_ERROR_MESSAGE =
  "Something went wrong. Please try again in a moment.";

/**
 * Some server-side failures (e.g. a misconfigured SMTP provider) return a
 * malformed or empty error body — supabase-js then falls back to something
 * like the literal string "{}" for `.message`, which is meaningless shown to
 * a user. Guard against that here rather than rendering it verbatim.
 */
function normalizeError(
  error: { message: string } | null | undefined
): NormalizedAuthError | null {
  if (!error) return null;
  const message = error.message?.trim();
  const isUsefulMessage = Boolean(message) && !/^[{[]/.test(message);
  return { message: isUsefulMessage ? message : GENERIC_ERROR_MESSAGE };
}

export async function signUpWithPassword(
  email: string,
  password: string
): Promise<AuthSessionResult> {
  if (!supabase) {
    return { user: null, session: null, error: NOT_CONFIGURED_ERROR };
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  return {
    user: data.user,
    session: data.session,
    error: normalizeError(error),
  };
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<AuthSessionResult> {
  if (!supabase) {
    return { user: null, session: null, error: NOT_CONFIGURED_ERROR };
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return {
    user: data.user,
    session: data.session,
    error: normalizeError(error),
  };
}

/**
 * Redirects the browser to Google's OAuth consent screen. supabase-js
 * navigates away as part of this call (via window.location) on success, so
 * the returned promise resolving with no error is not "signed in" — the
 * actual session only exists once the redirect back to `redirectTo`
 * completes and lands on AuthCallbackPage, which calls completeAuthFromUrl
 * (the PKCE `?code=...` branch handles this exact flow already).
 *
 * Requires the Google provider to be enabled in the Supabase project
 * dashboard (Authentication -> Providers -> Google) with a Google Cloud
 * OAuth client ID/secret configured there — that's project-level
 * configuration outside this repo, not something this function can turn on.
 */
export async function signInWithGoogle(
  redirectTo?: string
): Promise<AuthResult> {
  if (!supabase) {
    return { error: NOT_CONFIGURED_ERROR };
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: redirectTo ? { redirectTo } : undefined,
  });
  return { error: normalizeError(error) };
}

export async function signInWithMagicLink(
  email: string,
  redirectTo?: string
): Promise<AuthResult> {
  if (!supabase) {
    return { error: NOT_CONFIGURED_ERROR };
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
  });
  return { error: normalizeError(error) };
}

/**
 * Completes a magic-link (or other email OTP) sign-in from the redirect URL.
 *
 * supabase-js's `detectSessionInUrl` only auto-completes the *implicit* flow
 * (an `#access_token=...` hash fragment). Supabase's default magic-link email
 * template instead redirects with `?token_hash=...&type=...` query params,
 * which must be explicitly exchanged via `verifyOtp` — nothing does this
 * automatically. A `?code=...` param (PKCE, e.g. some OAuth flows) is handled
 * the same way via `exchangeCodeForSession`. If neither param is present,
 * this falls back to reading whatever session `detectSessionInUrl` already
 * parsed from a hash fragment, so this function is safe to call
 * unconditionally from the callback page regardless of which flow fired.
 */
export async function completeAuthFromUrl(
  url: string
): Promise<AuthSessionResult> {
  if (!supabase) {
    return { user: null, session: null, error: NOT_CONFIGURED_ERROR };
  }
  const params = new URL(url).searchParams;
  const tokenHash = params.get("token_hash");
  const code = params.get("code");

  if (tokenHash) {
    const type = (params.get("type") as EmailOtpType | null) ?? "email";
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    return {
      user: data.user,
      session: data.session,
      error: normalizeError(error),
    };
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    return {
      user: data.user,
      session: data.session,
      error: normalizeError(error),
    };
  }

  const { data, error } = await supabase.auth.getSession();
  return {
    user: data.session?.user ?? null,
    session: data.session,
    error: normalizeError(error),
  };
}

export async function signOut(): Promise<AuthResult> {
  if (!supabase) {
    // Nothing to sign out of when no backend is configured — not an error.
    return { error: null };
  }
  const { error } = await supabase.auth.signOut();
  return { error: normalizeError(error) };
}
