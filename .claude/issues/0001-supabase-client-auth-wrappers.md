# Issue #0001: Supabase client + typed auth wrappers

- Parent contract: supabase-auth
- Status: resolved
- Created: 2026-07-25

## Problem

There is no `src/lib/supabase/` module yet. Nothing else in this task can call Supabase without it.
Build the foundational client + typed auth wrapper layer.

## Acceptance criteria

- [ ] `src/lib/supabase/client.ts` — lazily-constructed singleton exporting `supabase: SupabaseClient
    | null` and `isSupabaseConfigured(): boolean`, mirroring the existing `DEMO_MODE_ENABLED`-style
      pattern in `useStore.ts` — must never throw if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are
      absent (backend is optional per CLAUDE.md).
- [ ] `src/lib/supabase/auth.ts` — typed wrappers returning a normalized `{ error: { message } | null,
    ... }` shape (never a raw Supabase error object) for: `signUpWithPassword(email, password)`,
      `signInWithPassword(email, password)`, `signInWithMagicLink(email, redirectTo?)`, `signOut()`.
      Deliberately no `signInWithOAuth` — but the file/shape should leave room for one later (same
      file, same error-normalization pattern) without needing a rewrite.
- [ ] `src/lib/supabase/session.ts` — `getSession()` and `subscribeToAuthChanges(cb)` (thin wrapper
      over `supabase.auth.onAuthStateChange`, returns an unsubscribe function).
- [ ] `src/lib/supabase/index.ts` — barrel export of the above.
- [ ] No real credentials, PII, or hardcoded project refs/keys in code — reads only from
      `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

## Context

- `src/store/useStore.ts` lines 29-30 define the flag pattern to mirror:
  `export const DEMO_MODE_ENABLED = import.meta.env.VITE_ENABLE_DEMO_MODE !== "false";`
  — a plain exported constant computed at module scope directly from `import.meta.env`, no
  class/singleton machinery. Lines 24-27 already comment that `src/lib/supabase/` is the intended
  adapter this store will hand off to later (issue #0005), so keep this module's public shape stable.
- `src/lib/voice/transcribe.ts` lines 7-9 is the closest existing precedent for `isSupabaseConfigured()`:
  `export const SERVER_STT_CONFIGURED = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);`
  Reuse this exact boolean expression (both vars must be present) as `isSupabaseConfigured()`'s body.
- `src/vite-env.d.ts` (14 lines) already declares both vars as optional:
  `readonly VITE_SUPABASE_URL?: string;` / `readonly VITE_SUPABASE_ANON_KEY?: string;` — no edits
  needed there; `import.meta.env.VITE_SUPABASE_URL` is simply `undefined` when absent, never throws.
- `package.json` has `@supabase/supabase-js: ^2.110.8` already installed (v2 API). Exact calls to wrap:
  `createClient(url, anonKey)`; `supabase.auth.signUp({ email, password })`;
  `supabase.auth.signInWithPassword({ email, password })`;
  `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })` for magic link;
  `supabase.auth.signOut()`; `supabase.auth.getSession()` → `{ data: { session }, error }`;
  `supabase.auth.onAuthStateChange((event, session) => ...)` → returns
  `{ data: { subscription } }`, unsubscribe via `subscription.unsubscribe()`. All v2 auth calls already
  return `{ data, error }` with `error: AuthError | null` exposing `.message` — normalize by mapping to
  `{ error: error ? { message: error.message } : null }`.
- CLAUDE.md hard rules that bind this file: no real PII anywhere (rule 3); env vars must be `VITE_`-
  prefixed and never hold real secrets (Conventions, lines 80-82) — the anon key is explicitly fine per
  `vite-env.d.ts`'s doc comment (RLS-protected); backend is optional and the app must run fully
  client-side without it (Stack section, line 21) — reinforces "never throw if env vars are absent."
- No existing test file references "supabase" anywhere under `src/` (confirmed via repo-wide search) —
  no prior test scaffolding/mocking pattern to match; this will be the first Supabase-related test setup.
- Parent contract (`.claude/contracts/supabase-auth/main.md` lines 44-56) notes supabase-js persists its
  own session under its own localStorage key (no collision with the zustand `fluidsense-store-v2` key)
  and auto-detects magic-link sessions from the URL by default — relevant to how `session.ts`'s
  `getSession`/`subscribeToAuthChanges` will later be consumed by issue #0002's `useAuthStore` and
  issue #0005's `accountSync.ts`, so keep those two function signatures simple and stable.

## Touch manifest

- `src/lib/supabase/client.ts` — whole file, new. Exports lazily-constructed singleton `supabase:
SupabaseClient | null` and `isSupabaseConfigured(): boolean`.
- `src/lib/supabase/auth.ts` — whole file, new. Exports `signUpWithPassword`, `signInWithPassword`,
  `signInWithMagicLink`, `signOut`, all returning normalized `{ error: { message } | null, ... }`.
- `src/lib/supabase/session.ts` — whole file, new. Exports `getSession()` and
  `subscribeToAuthChanges(cb)`.
- `src/lib/supabase/index.ts` — whole file, new. Barrel export of the above three modules.

## Resolution

Built the `src/lib/supabase/` foundational layer as four new files, exactly matching the touch
manifest:

- **`client.ts`** — `isSupabaseConfigured(): boolean` (reuses the exact
  `Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)` expression
  from `transcribe.ts`'s `SERVER_STT_CONFIGURED`) and `export const supabase: SupabaseClient | null`,
  a module-scope constant (mirrors `DEMO_MODE_ENABLED`'s pattern) that only calls `createClient(url,
anonKey)` when configured, otherwise `null`. Never throws when env vars are absent.
- **`auth.ts`** — `signUpWithPassword(email, password)`, `signInWithPassword(email, password)`,
  `signInWithMagicLink(email, redirectTo?)`, `signOut()`. All wrap the exact v2 calls listed in
  Context (`supabase.auth.signUp`, `signInWithPassword`, `signInWithOtp` with
  `options.emailRedirectTo`, `signOut`) and normalize every result to
  `{ error: { message } | null, ... }` via a shared `normalizeError` helper — never a raw
  `AuthError`. When `supabase` is `null`, each resolves to a `"Supabase is not configured."` error
  (or `{ error: null }` for `signOut`, since there's nothing to sign out of) instead of throwing. No
  `signInWithOAuth` yet, but the shared `AuthResult`/`AuthSessionResult` shapes leave room to add one
  without a rewrite.
- **`session.ts`** — `getSession()` wraps `supabase.auth.getSession()` → normalized
  `{ session, error }`; `subscribeToAuthChanges(cb)` wraps `supabase.auth.onAuthStateChange(cb)` and
  returns `() => subscription.unsubscribe()`. Both no-op safely (empty session / no-op unsubscribe)
  when unconfigured.
- **`index.ts`** — barrel re-exporting all of the above (values and their associated types).

No hardcoded credentials, project refs, or PII — every read goes through
`import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, already declared optional in
`src/vite-env.d.ts` (untouched).

**Verification:** `npm run typecheck` (`tsc -b`) passes with zero errors across the whole repo.
`npm run lint` (`oxlint`) passes with zero errors; the only output is two pre-existing warnings in
`src/hooks/useFluidData.ts` (react-hooks exhaustive-deps), unrelated to this change.

**Exact exported signatures for downstream issues:**

```ts
// client.ts
export function isSupabaseConfigured(): boolean;
export const supabase: SupabaseClient | null;

// auth.ts
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
export function signUpWithPassword(
  email: string,
  password: string
): Promise<AuthSessionResult>;
export function signInWithPassword(
  email: string,
  password: string
): Promise<AuthSessionResult>;
export function signInWithMagicLink(
  email: string,
  redirectTo?: string
): Promise<AuthResult>;
export function signOut(): Promise<AuthResult>;

// session.ts
export interface SessionResult {
  session: Session | null;
  error: { message: string } | null;
}
export type AuthChangeCallback = (
  event: AuthChangeEvent,
  session: Session | null
) => void;
export function getSession(): Promise<SessionResult>;
export function subscribeToAuthChanges(cb: AuthChangeCallback): () => void;

// index.ts re-exports all of the above (values + types).
```
