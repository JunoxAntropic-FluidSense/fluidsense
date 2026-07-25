# Issue #0002: Auth session store + bootstrap

- Parent contract: supabase-auth
- Status: resolved
- Created: 2026-07-25

## Problem

Nothing persists/restores/observes Supabase session state today. Build a small, non-persisted auth
session store and a bootstrap that feeds it at app start.

## Acceptance criteria

- [ ] `src/store/useAuthStore.ts` (new) — a small zustand store (NOT persisted via `persist` — the
      Supabase SDK already persists its own session under its own localStorage key) holding
      session/user/status (`"loading" | "signed-in" | "signed-out"`) and nothing else. Keep it
      separate from `src/store/useStore.ts` — this is session state, not app data.
- [ ] A bootstrap mechanism (e.g. `src/hooks/useAuthBootstrap.ts` or a small `AuthBootstrap` component
      under `src/lib/supabase/`) that calls `getSession()` once on mount and
      `subscribeToAuthChanges(cb)` to keep `useAuthStore` in sync, cleaning up the subscription on
      unmount.
- [ ] Small edit to `src/main.tsx` to mount the bootstrap once, wrapping `<App />` — do not touch
      `src/App.tsx` (Issue 4 owns routing changes there).
- [ ] If Supabase isn't configured (`isSupabaseConfigured()` is false from Issue 1's client module),
      the bootstrap must no-op cleanly and leave status as `"signed-out"` — never throw, never block
      app render.

## Context

**`src/store/useStore.ts` conventions (full file read, 709 lines):**

- Created via `create<StoreState>()(persist((set, get) => ({...}), { name: "...", partialize: ... }))` from `import { create } from "zustand";` and `import { persist } from "zustand/middleware";` (lines 1-2, 238-708).
- State interface (`StoreState`, lines 42-124) declares plain fields first, then action methods typed inline as arrow-function properties (e.g. `setMode: (mode: Mode) => void;`), grouped with `// --- section name ---` comment banners.
- Actions are implemented with `set((s) => ({...}))` (functional updater reading prior state) or plain `set({...})` for unconditional replacement; `get()` used inside actions that need to read current state synchronously (e.g. `enterDemoMode`, `startNewDay`).
- Env-flag pattern to mirror for `isSupabaseConfigured()`-style checks: `export const DEMO_MODE_ENABLED = import.meta.env.VITE_ENABLE_DEMO_MODE !== "false";` (lines 29-30) — a top-level exported const computed once from `import.meta.env`, never throwing.
- Explicit code comment (lines 24-27) already anticipates this: "Persistence is intentionally routed only through this store... so a real backend such as Supabase can later replace the `persist` middleware without touching the UI layer — see `src/lib/supabase/` for the adapter this is designed to hand off to." This confirms `useAuthStore` should be a separate, sibling store file, not folded into `useStore`.
- `useStore` is the only store today; there is no existing non-persisted store to copy — `useAuthStore.ts` will be the first zustand store in this codebase that omits the `persist` middleware entirely, i.e. just `export const useAuthStore = create<AuthState>()((set) => ({...}));`.

**`src/main.tsx` (full file, 13 lines) — exact current structure:**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
```

For a minimal diff, the bootstrap should wrap `<App />` inside (or alongside) `<ErrorBoundary>` — e.g. add one new import line for the bootstrap and wrap `<App />` with it between `<ErrorBoundary>` and `<App />`, without altering `StrictMode`/`ErrorBoundary`/`createRoot` structure. If the chosen mechanism is a hook (`useAuthBootstrap`) rather than a wrapper component, `main.tsx` cannot call a hook directly (not a component) — so a thin wrapper component (e.g. `AuthBootstrap` that calls the hook and renders `children`) is the more natural fit for insertion here, or the hook could be called inside `App.tsx`, but the issue explicitly says not to touch `App.tsx`, so a small wrapper component invoked from `main.tsx` is the correct shape.

**`src/hooks/` conventions (dir listing: useEscapeClose.ts, useFluidData.ts, useOnlineStatus.ts, useVoiceCapture.ts):**

- `src/hooks/useOnlineStatus.ts` (full file, 20 lines) is the closest analogue for `useAuthBootstrap`: a plain function hook (`export function useOnlineStatus() {...}`), using `useState`/`useEffect` from `"react"`, subscribing to a browser event/external source inside `useEffect`, and returning an unsubscribe cleanup function from the effect (`window.addEventListener` / `removeEventListener` pairs, lines 8-17). `useAuthBootstrap` should follow the same shape: subscribe in `useEffect` (calling `getSession()` once, then `subscribeToAuthChanges(cb)`), and return the unsubscribe function from `subscribeToAuthChanges` as the effect's cleanup.
- No hook in this directory currently reads `import.meta.env` directly; the guard-check for "Supabase not configured" should come from `isSupabaseConfigured()` (Issue 1's export), not a new env read, per acceptance criteria.

**Issue 1 (`0001-supabase-client-auth-wrappers.md`) contract — exact signatures this issue's implementation must import (module does not exist yet; expected until Issue 1 lands):**

- `src/lib/supabase/client.ts` exports `supabase: SupabaseClient | null` and `isSupabaseConfigured(): boolean` — lazily-constructed singleton, never throws if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are absent.
- `src/lib/supabase/session.ts` exports `getSession()` and `subscribeToAuthChanges(cb)` — the latter is "a thin wrapper over `supabase.auth.onAuthStateChange`, returns an unsubscribe function."
- `src/lib/supabase/auth.ts` exports typed wrappers (`signUpWithPassword`, `signInWithPassword`, `signInWithMagicLink`, `signOut`) returning normalized `{ error: { message } | null, ... }` shapes — not directly needed by this issue's store/bootstrap, but confirms the error-normalization convention used across the Supabase layer.
- `src/lib/supabase/index.ts` is the barrel export — this issue's bootstrap/store should import from `../lib/supabase` (barrel) or the specific submodule (`../lib/supabase/session`), matching whichever the barrel re-exports.
- As of this investigation, `src/lib/supabase/` does not exist on disk yet — confirmed via `ls`, consistent with Issue 1 being unbuilt. Type-check/build of this issue's code will fail until Issue 1 lands; that is expected and not a defect in this issue's contract.

**Other relevant repo facts:**

- `src/App.tsx` currently wraps routes in `<BrowserRouter><Routes>...` with no session/auth awareness yet (confirms Issue 4 owns that layer, per acceptance criteria note).
- `CLAUDE.md` (lines 19-20, 35) documents Supabase as an optional backend ("Backend (Supabase: auth, Postgres + ...") and lists `supabase/` as a top-level project folder (CLI config), distinct from `src/lib/supabase/` (client code) — reinforcing that `isSupabaseConfigured() === false` must be a fully supported, non-error runtime state.

## Touch manifest

- `src/store/useAuthStore.ts` (new) — non-persisted zustand store: session, user, status.
- `src/hooks/useAuthBootstrap.ts` (new) — hook that calls `getSession()` once and
  `subscribeToAuthChanges(cb)` on mount, feeding `useAuthStore`, cleaning up on unmount.
- `src/lib/supabase/AuthBootstrap.tsx` (new) — thin wrapper component that calls
  `useAuthBootstrap()` and renders `children`, for mounting from `main.tsx` (which can't call a
  hook directly).
- `src/main.tsx` (edit) — mount `<AuthBootstrap>` wrapping `<App />`, inside `<ErrorBoundary>`.

## Resolution

Built exactly per the touch manifest, using Issue 1's real exports (`getSession`, `subscribeToAuthChanges`
from `../lib/supabase`, and the fact that both already no-op cleanly when `isSupabaseConfigured()` is
false — so the bootstrap needed no extra guard of its own).

**Files touched:**

- `src/store/useAuthStore.ts` (new) — non-persisted zustand store. Exported shape:

  ```ts
  export type AuthStatus = "loading" | "signed-in" | "signed-out";
  interface AuthState {
    session: Session | null;
    user: User | null;
    status: AuthStatus;
    setSession: (session: Session | null) => void;
  }
  export const useAuthStore = create<AuthState>()((set) => ({ ... }));
  ```

  `setSession(session)` is the only action: it derives `user` from `session?.user ?? null` and `status`
  from whether `session` is truthy (`"signed-in"` / `"signed-out"`). Initial state is
  `{ session: null, user: null, status: "loading" }`.

- `src/hooks/useAuthBootstrap.ts` (new) — plain hook, same shape as `useOnlineStatus.ts`. On mount,
  calls `getSession()` once (guarded by a `cancelled` flag against post-unmount `setSession` calls under
  StrictMode's double-invoke), then `subscribeToAuthChanges(cb)`; returns the unsubscribe function as
  effect cleanup.
- `src/lib/supabase/AuthBootstrap.tsx` (new) — thin wrapper component (`{ children }: { children: ReactNode }`) that calls `useAuthBootstrap()` and renders `children` unchanged, so `main.tsx` can mount
  it without calling a hook directly.
- `src/main.tsx` (edit) — one new import (`AuthBootstrap`) and `<App />` now wrapped in
  `<AuthBootstrap>` inside `<ErrorBoundary>`; `StrictMode`/`ErrorBoundary`/`createRoot` structure
  untouched, `src/App.tsx` untouched.

**Verification:**

- `npm run typecheck` (`tsc -b`, repo-wide) — clean, no output.
- `npm run lint` (`oxlint`, repo-wide) — clean; only pre-existing warnings in
  `src/hooks/useFluidData.ts` (unrelated to this issue, not touched here).
