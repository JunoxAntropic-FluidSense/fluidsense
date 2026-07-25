// Typed auth wrappers around supabase-js v2. Every function here returns a
// normalized result shape — never a raw Supabase AuthError — so callers never
// need to know about supabase-js's error type. When no backend is configured
// (see ./client.ts), calls resolve to a "not configured" error instead of
// throwing, per CLAUDE.md's "backend is optional" rule.
//
// Deliberately no signInWithOAuth yet — but every result here follows the same
// { error: { message } | null, ... } shape, so adding one later is additive,
// not a rewrite.

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

function normalizeError(
  error: { message: string } | null | undefined
): NormalizedAuthError | null {
  return error ? { message: error.message } : null;
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
