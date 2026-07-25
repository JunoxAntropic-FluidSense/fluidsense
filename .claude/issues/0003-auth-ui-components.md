# Issue #0003: Auth UI components

- Parent contract: supabase-auth
- Status: resolved
- Created: 2026-07-25

## Problem

No sign-up/sign-in/sign-out UI exists anywhere in the app. Build the reusable components; wiring them
into onboarding/routing is Issue 4's job, not this one.

## Acceptance criteria

- [ ] New components under `src/pages/auth/` or `src/components/auth/` (pick one, be consistent with
      existing conventions — `components/` holds design-system/shared pieces per the project structure
      in CLAUDE.md): an `AuthForm` (or split `EmailPasswordForm` + `MagicLinkForm`) covering sign-up
      and sign-in via both methods, and a `SignOutButton`.
- [ ] Use the existing design system (`src/components/ui/Button.tsx`, `Card.tsx`, etc.) — don't
      introduce new one-off styling patterns.
- [ ] Loading and error states surfaced from Issue 1's normalized `auth.ts` error shape and Issue 2's
      `useAuthStore` status — no raw Supabase errors shown to the user.
- [ ] No diagnostic/clinical language anywhere (CLAUDE.md hard rule) — not relevant to auth copy
      directly, but keep in mind if any placeholder/example copy is added.
- [ ] Components are presentational/self-contained — do not modify `WelcomePage.tsx`, `OnboardingFlow.tsx`,
      or `App.tsx` (Issue 4 owns wiring them in).

## Context

- Design system: `src/components/ui/Button.tsx` has variants `primary/secondary/ghost/output/danger`,
  sizes `md/lg/xl`, `fullWidth`, optional `icon` prop, uses `forwardRef`. `Card`/`CardHeading` is a
  plain white rounded-3xl wrapper. `Badge` has a `tone` prop including `alert`. There is **no**
  existing `Input`/`Field`/`FormError` component — forms currently hand-roll inputs, e.g. (seen in
  `OnboardingFlow.tsx`, `IntakeFlowPage.tsx`):
  `<label className="block text-sm font-semibold text-navy-700">Label<input className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal"/></label>`
  New auth forms should follow this same hand-rolled input pattern rather than inventing a new one.
- Error banner convention, from `EditEventModal.tsx`:
  `rounded-xl border border-alert-100 bg-alert-50 p-3` wrapping `text-sm text-alert-600 font-semibold`
  text — reuse this exact pattern for surfacing `auth.ts`'s normalized `{ error: { message } }`.
- Design tokens live in `src/index.css` under `@theme`: `navy` / `intake` (teal) / `output` (purple) /
  `amber` / `fog` (grey) / `alert` (red) color scales. Tailwind v4 via `@tailwindcss/vite`, no separate
  `tailwind.config.js` — token names above are what any new component's classes should draw from.
- `src/pages/auth/` and `src/components/auth/` are both confirmed absent (neither exists yet).
  `src/lib/supabase/` is also absent (Issue 1 not yet landed). Per CLAUDE.md's structure section,
  `pages/` = routed screens, `components/` = reusable/design-system pieces — since these auth
  components are reusable, presentational pieces (not routed screens themselves), **`src/components/auth/`
  is the recommended location**, consistent with existing `components/ui/`, `components/nav/`,
  `components/today/` groupings.
- Issue 1's contract promises `signUpWithPassword`, `signInWithPassword`, `signInWithMagicLink`,
  `signOut` from `src/lib/supabase/auth.ts`, all returning `{ error: { message } | null, ... }`.
- Issue 2's contract promises a `useAuthStore` exposing `status: "loading" | "signed-in" | "signed-out"`
  (exact additional fields TBD until it lands, but `status` is the one this issue needs for
  loading/disabled-button states).

## Touch manifest

- `src/components/auth/EmailPasswordForm.tsx` (new) — email+password sign-up/sign-in form
- `src/components/auth/MagicLinkForm.tsx` (new) — magic-link sign-in form
- `src/components/auth/SignOutButton.tsx` (new) — sign-out button
- `src/components/auth/index.ts` (new) — barrel export for the three components above

No existing files are modified — `WelcomePage.tsx`, `OnboardingFlow.tsx`, and `App.tsx` are untouched
(Issue 4's job).

## Resolution

Built as **split** `EmailPasswordForm` + `MagicLinkForm` (not a combined `AuthForm`) plus a
`SignOutButton`, all under `src/components/auth/`, with a barrel `index.ts`. Chose the split
because sign-up/sign-in-by-password and magic-link are different Supabase calls with different
success semantics (password flows resolve to a session synchronously; magic-link only sends an
email), so keeping them as separate components avoids one component branching on both mode and
method. Issue 4 composes them together (e.g. in a tabbed or stacked layout) wherever it wires
auth into the app.

Confirmed both dependencies directly from their real landed files (not assumed):

- Issue 1's `src/lib/supabase/auth.ts`: `signUpWithPassword`, `signInWithPassword` return
  `AuthSessionResult` (`{ user, session, error }`); `signInWithMagicLink` and `signOut` return
  `AuthResult` (`{ error }`); `error` is `{ message: string } | null` in all cases — used directly,
  no raw Supabase error ever surfaced.
- Issue 2's `src/store/useAuthStore.ts` was already landed (not just assumed) by the time this
  ran: `useAuthStore` exposes `status: "loading" | "signed-in" | "signed-out"` exactly as
  documented in this issue's Context — used to add a `busy` guard (disables inputs/submit) on top
  of each component's own local `submitting` state.

### Files touched (all new)

- `src/components/auth/EmailPasswordForm.tsx`
- `src/components/auth/MagicLinkForm.tsx`
- `src/components/auth/SignOutButton.tsx`
- `src/components/auth/index.ts`

No existing file was modified — `WelcomePage.tsx`, `OnboardingFlow.tsx`, `App.tsx` untouched, per
the manifest.

### Exported components (for Issue 4 to import)

```ts
import {
  EmailPasswordForm,
  MagicLinkForm,
  SignOutButton,
} from "src/components/auth";
// or import each directly from its own file.
```

- `EmailPasswordForm({ mode?: "sign-in" | "sign-up" = "sign-in", onSuccess?: (session: Session) => void, className?: string })`
  — hand-rolled email/password inputs, submit button reads "Sign in" / "Create account" depending
  on `mode`. Calls `onSuccess(session)` only when a session actually comes back (sign-up with
  email confirmation enabled returns no session — that case surfaces as an inline non-error
  message asking the user to confirm their email, not a call to `onSuccess`).
- `MagicLinkForm({ onSuccess?: () => void, redirectTo?: string, className?: string })` — single
  email input; `onSuccess` fires once the link email is sent (never implies a session — the
  component swaps to a "check your email" confirmation state and does not call back with a
  session since none exists yet).
- `SignOutButton({ onSignOut?: () => void, variant?: "primary"|"secondary"|"ghost"|"output"|"danger" = "secondary", className?: string, children?: ReactNode = "Sign out" })`
  — calls `onSignOut()` on success; renders its own alert-banner on failure.

All three: use `Button` from `src/components/ui/Button.tsx`, the hand-rolled
`<label><input className="mt-1 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-normal">`
pattern, and the `rounded-xl border border-alert-100 bg-alert-50 p-3` / `text-sm text-alert-600
font-semibold` error-banner convention verbatim. No diagnostic/clinical language; no PII in any
placeholder copy (`you@example.com` only).

### Verification

- `npm run typecheck` (`tsc -b`) — clean, no errors.
- `npm run lint` (`oxlint`) — clean; the only warnings reported are pre-existing
  `react-hooks/exhaustive-deps` warnings in `src/hooks/useFluidData.ts`, unrelated to this change.
- Not manually run in-browser (presentational components with no wiring yet — Issue 4 will
  exercise them live once composed into a screen).
