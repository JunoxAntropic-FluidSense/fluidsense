# Issue #0004: Wire auth into onboarding + routing

- Parent contract: supabase-auth
- Status: resolved
- Created: 2026-07-25

## Problem

`WelcomePage`/`OnboardingFlow` have zero backend involvement today, and there's no route for a
magic-link redirect to land on.

## Acceptance criteria

- [ ] `src/pages/onboarding/WelcomePage.tsx` gets a "Sign in" entry point alongside the existing
      "Explore demo" entry point — sign-in must stay fully optional; the app must keep working with
      zero auth exactly as it does today (CLAUDE.md: backend is optional).
- [ ] `src/pages/onboarding/OnboardingFlow.tsx` gets an optional step to sign up, using Issue 3's
      components — must not block or change the flow for someone who skips it.
- [ ] New public route `/auth/callback` in `src/App.tsx` (outside `RequireOnboarding`) rendering a new
      `src/pages/auth/AuthCallbackPage.tsx` that hands off cleanly to `/` or `/welcome` after a
      magic-link redirect completes.
- [ ] Do not modify `RequireOnboarding.tsx` — per the approved plan, it stays local-only and unchanged;
      auth is an optional path, not a hard gate.
- [ ] Do not touch `src/main.tsx` (Issue 2 owns that) or `src/store/useStore.ts` (Issue 5 owns that).

## Context

**`src/App.tsx` (46 lines) — exact route structure:**

- Line 1: imports `BrowserRouter, Routes, Route` from `react-router-dom`.
- Lines 2-17: imports `RequireOnboarding` and all page components (no auth-related imports exist yet).
- Line 21: `<BrowserRouter>` wraps everything; line 22 opens `<Routes>`.
- Lines 23-26: **public routes** rendered directly as siblings, outside any gate: `/welcome` (`WelcomePage`), `/onboarding` (`OnboardingFlow`), `/privacy` (`PrivacyPage`), `/terms` (`TermsPage`).
- Line 27: `<Route element={<RequireOnboarding />}>` opens the gated group; lines 28-38 are nested child routes (`/`, `/add`, `/add/intake`, `/add/output`, `/voice`, `/history`, `/summary`, `/profile`, `/settings/data`, `/dashboard`, `/drinks`); line 39 closes `</Route>`.
- Line 40 closes `</Routes>`, line 41 closes `</BrowserRouter>`.
- **New `/auth/callback` route must be added as a public sibling** alongside lines 23-26 (i.e. inside `<Routes>` but _outside/before_ the `<Route element={<RequireOnboarding />}>` block starting at line 27), e.g. a new line `<Route path="/auth/callback" element={<AuthCallbackPage />} />` plus a new import for `AuthCallbackPage` from `./pages/auth/AuthCallbackPage` alongside the existing page imports (lines 3-17). No file at `src/pages/auth/AuthCallbackPage.tsx` exists yet — it must be created new (not owned by another issue).

**`src/pages/onboarding/WelcomePage.tsx` (75 lines):**

- Lines 7-16: component reads `onboardingCompleted` and `viewContext` from `useStore`, plus `enterDemoMode`; redirects to `/` via `<Navigate replace />` if onboarding is already done or in demo mode.
- Lines 39-56: the button stack — `Button fullWidth size="xl"` "Get started" (navigates to `/onboarding`, line 40-42), then conditionally (`DEMO_MODE_ENABLED`, imported from `../../store/useStore` line 2) a `Button fullWidth size="lg" variant="secondary"` "Explore demo" (lines 44-55) that calls `enterDemoMode()` then `navigate("/")`.
- Lines 57-62: conditional demo-mode helper text.
- Lines 63-71: Privacy/Terms footer links using `Link` from `react-router-dom` (already imported line 1).
- A "Sign in" entry point should be added near the button stack (lines 39-56), e.g. a third `Button` (or a text `Link`/ghost button) navigating to a new sign-in surface — must stay fully optional and not affect the `onboardingCompleted`/demo redirect logic in lines 15-16.

**`src/pages/onboarding/OnboardingFlow.tsx` (338 lines):**

- Local `step` state (line 54, `useState(1)`) drives a 3-step wizard: step 1 = account-mode chooser (lines 107-140, sets `accountMode` to `"patient"` or `"healthcare"` then `setStep(2)`); step 2 = details form, branched by `accountMode === "patient"` (lines 142-221) or `"healthcare"` (lines 223-295), each ending in a `Button` "Continue" calling `setStep(3)`; step 3 = review/confirm (lines 297-333) with `Button fullWidth size="xl"` "Start using FluidSense" (line 326) calling `finish()` (defined lines 70-90, calls `completeOnboarding(...)` from `useStore` then `navigate("/")`), and a "Back" ghost button (line 329) returning to step 2.
- Header at lines 96-105 shows "Step {step} of 3" — adding an optional sign-up step would need either: (a) inserting it as an additional step without changing the "of 3" count semantics (e.g. an optional step between account-mode and finish that can be skipped), or (b) adding it as an extra sub-section within step 3 before/after the "Start using FluidSense" button. Either way it must not block reaching `finish()`/`navigate("/")` for someone who skips it.
- No auth-related imports currently exist in this file.

**`src/components/nav/RequireOnboarding.tsx` (16 lines) — confirmed, must NOT be touched:**

- Reads `onboardingCompleted` and `viewContext` from `useStore` (lines 6-9).
- Line 11: if `!onboardingCompleted && viewContext === "live"`, redirects to `/welcome`.
- Otherwise renders `<AppShell />` (line 15). It gates purely on local onboarding/demo state — no reference to auth/session state exists or should be added here, per the acceptance criteria.

**`src/store/useStore.ts` — relevant existing state (read-only, not to be touched, Issue 5 owns it):**

- `viewContext: "live" | "demo"` (line 53), `currentUser.onboardingCompleted` (line 138 default `false`), `completeOnboarding` (line 57/254), `enterDemoMode` (line 62/353), `DEMO_MODE_ENABLED` (line 29). No auth-related state (`session`, `user`, etc.) exists yet in this store.

**Dependency on Issue #0003 (auth UI components) — not yet implemented:**

- Issue 3 is still open/pending; no files exist yet at `src/pages/auth/` or `src/components/auth/`, and no `src/lib/auth.ts` (Issue 1) or `useAuthStore` (Issue 2) exist yet either (confirmed via repo-wide search — no auth-named files found under `src/`).
- Per Issue 3's contract, it will export an `AuthForm` (or split `EmailPasswordForm`/`MagicLinkForm`) covering sign-up and sign-in, plus a `SignOutButton`, built on the existing design system (`src/components/ui/Button.tsx`, `Card.tsx`), with loading/error states sourced from Issue 1's normalized `auth.ts` error shape and Issue 2's `useAuthStore` status. Issue 3 explicitly must NOT modify `WelcomePage.tsx`, `OnboardingFlow.tsx`, or `App.tsx` — that wiring is this issue's (#0004's) job. This means the sign-in entry point and optional sign-up step in `WelcomePage.tsx`/`OnboardingFlow.tsx` will need to import and render Issue 3's presentational components (exact export names/paths TBD until Issue 3 lands), and the `AuthCallbackPage.tsx` will need Issue 1's auth helpers / Issue 2's store to detect session completion.

## Touch manifest

- `src/pages/onboarding/WelcomePage.tsx` (edit) — add a "Sign in" ghost button to the
  existing button stack that toggles an inline, collapsible `Card` containing
  `EmailPasswordForm` (`mode="sign-in"`) and, via a text toggle, `MagicLinkForm`
  (`redirectTo` pointing at `/auth/callback`). No new route; sign-in success navigates to
  `/onboarding` (local onboarding is still required regardless of auth). Does not touch the
  `onboardingCompleted`/demo `<Navigate>` redirect (lines 15-16) or the `DEMO_MODE_ENABLED`
  button.
- `src/pages/onboarding/OnboardingFlow.tsx` (edit) — add an optional, collapsed-by-default
  "Create an account (optional)" `Card` inside step 3 (between the existing summary card and
  the "Start using FluidSense" button), containing `EmailPasswordForm` (`mode="sign-up"`) and
  a `MagicLinkForm` toggle. Purely additive local state (`showSignUp`, `signUpUseMagicLink`,
  `signUpDone`); does not touch `finish()`, `step` semantics, or the "Step X of 3" header.
- `src/App.tsx` (edit) — add `import { AuthCallbackPage } from "./pages/auth/AuthCallbackPage";`
  alongside the existing page imports, and add
  `<Route path="/auth/callback" element={<AuthCallbackPage />} />` as a public sibling route
  (before the `<Route element={<RequireOnboarding />}>` block, alongside `/welcome`,
  `/onboarding`, `/privacy`, `/terms`).
- `src/pages/auth/AuthCallbackPage.tsx` (new) — waits for `getSession()` to resolve (supabase-js
  parses the session out of the redirect URL on load), mirrors it into `useAuthStore` via
  `setSession`, then `<Navigate>`s to `/` if `currentUser.onboardingCompleted` is true, else
  `/welcome`. Shows a brief "Signing you in…" placeholder while waiting.
- Not touched: `src/components/nav/RequireOnboarding.tsx`, `src/main.tsx`, `src/store/useStore.ts`.

## Resolution

Implemented as planned in the touch manifest above.

- `src/pages/onboarding/WelcomePage.tsx`: added a `showSignIn`/`signInUseMagicLink` local
  state pair and a third `Button` ("Sign in" / "Hide sign in", `variant="ghost"`) in the
  existing button stack. When expanded, a `Card` renders `EmailPasswordForm` (sign-in mode,
  `onSuccess` navigates to `/onboarding`) or `MagicLinkForm` (`redirectTo` =
  `${window.location.origin}/auth/callback`), toggleable via a small text link. The
  `onboardingCompleted`/demo redirect (lines 15-16, unchanged) and `DEMO_MODE_ENABLED` demo
  button are untouched; sign-in is purely additive and optional.
- `src/pages/onboarding/OnboardingFlow.tsx`: added `showSignUp`/`signUpUseMagicLink`/
  `signUpDone` local state and an optional "Create an account (optional)" `Card` inside step 3,
  placed between the existing summary card and the "Start using FluidSense" button. It expands
  to show `EmailPasswordForm` (sign-up mode) or `MagicLinkForm`, toggle-driven, with copy
  making clear it can be skipped. `finish()`/`navigate("/")` and the "Step X of 3" header are
  unchanged; nothing here can block or alter reaching them.
- `src/App.tsx`: added `AuthCallbackPage` import and a new
  `<Route path="/auth/callback" element={<AuthCallbackPage />} />` as a public sibling route,
  placed with the other public routes, before the `RequireOnboarding`-gated group. No other
  lines changed.
- `src/pages/auth/AuthCallbackPage.tsx` (new): on mount, awaits `getSession()` from
  `src/lib/supabase`, mirrors the result into `useAuthStore.setSession`, then renders
  `<Navigate replace>` to `/` (if `currentUser.onboardingCompleted`) or `/welcome` otherwise.
  Shows a minimal "Signing you in…" placeholder (with `PrototypeBanner`) until the session
  lookup resolves. Does not import or modify `RequireOnboarding`, `main.tsx`, or `useStore.ts`.
- `RequireOnboarding.tsx`, `main.tsx`, `useStore.ts`: left untouched, confirmed via `git diff`.

**Verification:**

- `npm run typecheck` — clean (no errors).
- `npm run lint` — clean (no errors/warnings), repo-wide.
