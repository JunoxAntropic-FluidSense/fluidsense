# Contract: Implement Supabase Auth

- Task ID: supabase-auth
- Created: 2026-07-25
- Status: resolved
- Approval gate 1 (plan): approved (include issue 6) — 2026-07-25
- Approval gate 2 (scope + context): approved — 2026-07-25

## Request

Implement Supabase Auth in the FluidSense app (React 19 + TS + Vite + Zustand). Supabase project is
already connected: @supabase/supabase-js is installed, .env.local has VITE_SUPABASE_URL and
VITE_SUPABASE_ANON_KEY pointing at project ref grrnujftjleisbjndlwg, and the full schema
(supabase/migrations/0001_init.sql, RLS-scoped to auth.uid()) is already applied to that project with
zero security lints.

Scope: build sign-up, sign-in, sign-out with two methods — email+password and magic link (passwordless
email OTP). Do NOT add Google/OAuth yet — the user is configuring the Google provider separately in the
Supabase dashboard and will say when it's ready; structure the auth module so adding an OAuth provider
later is a small addition, not a rewrite, but don't build UI for it now.

Needs to cover: a Supabase client module (src/lib/supabase/ — referenced but not yet created, per the
comment in src/store/useStore.ts around line 25-27), session handling (persist/restore session, listen
for auth state changes), sign-up/sign-in/sign-out UI wired into the existing onboarding flow
(src/pages/onboarding/WelcomePage.tsx, OnboardingFlow.tsx) and route protection
(src/components/nav/RequireOnboarding.tsx currently gates on local onboarding state only — check
whether authentication gating belongs there too), and wiring src/store/useStore.ts so it can operate
against the real authenticated user's data instead of only localStorage, without breaking demo mode
(which must stay fully local and never touch Supabase — see the demo-mode isolation rules already in
the project's CLAUDE.md hard rules).

Must respect the project's CLAUDE.md hard rules (no PII in code/tests/demo data, demo-mode isolation,
voice-entry confirmation requirement) and the testing-requirement rule for calc.ts/reliability.ts/
period.ts/src/lib/voice/* if this work touches logic that flows through them.

## Plan

**Scope boundary (deliberate):** this is auth + account-identity sync, not a rewrite of `useStore.ts`
into a Postgres-backed CRUD layer. Fluid events/profiles/containers/etc. stay localStorage-only for
now — the only "real user data" synced is the `public.users` row (display name, role, mode, timezone,
units, onboarding flag, voice-transcript preference). Signing out never blocks or deletes local data —
it only stops cloud sync, keeping "the app works fully offline" true at all times.

**Client module** (`src/lib/supabase/`): `client.ts` (lazy singleton, `isSupabaseConfigured()`, never
throws if env vars absent), `auth.ts` (typed wrappers: `signUpWithPassword`, `signInWithPassword`,
`signInWithMagicLink`, `signOut` — normalized error shape, no `signInWithOAuth` yet but shaped so
adding one later is additive), `session.ts` (`getSession`, `subscribeToAuthChanges`), `index.ts` barrel.

**Session strategy:** supabase-js persists its own session under its own localStorage key (no collision
with the zustand `fluidsense-store-v2` key) and auto-detects magic-link sessions in the URL. A small,
non-persisted `useAuthStore` (session/status only) is fed by `getSession()` +
`subscribeToAuthChanges`, bootstrapped via a small wrapper mounted in `main.tsx`.

**Demo-mode isolation:** enforced in exactly one place, `accountSync.ts` — never inside `useStore.ts` —
guarding every Supabase call on `isSupabaseConfigured() && viewContext === "live"`. `enterDemoMode` /
`exitDemoMode` are untouched; "Explore demo" still requires zero auth.

**Store integration:** `useStore.ts` gets `authUserId: string | null` plus `linkAuthAccount` /
`unlinkAuthAccount` actions (same shape as existing actions) — no rewrite. All Supabase read/write
logic lives outside the store, in `accountSync.ts`.

**Route protection:** `RequireOnboarding` stays local-only and unchanged — local, unauthenticated,
fully-offline usage must keep working per CLAUDE.md. Auth is an optional path surfaced from
`WelcomePage` ("Sign in") and inside `OnboardingFlow`, plus one new public route `/auth/callback` for
magic-link redirects.

**Explicitly out of scope:** Google/OAuth UI (user is configuring the provider separately); syncing
profiles/fluid_events/containers/saved_fluids/monitoring_periods/weight_events/symptom_events/reminders
to Postgres (future initiative, schema already supports it); `account_deletion_requests` wiring is an
optional stretch issue only.

## Linked issues

1. **Supabase client + typed auth wrappers** — foundational, no `src/lib/supabase/` module exists yet.
   Files (new): `src/lib/supabase/client.ts`, `auth.ts`, `session.ts`, `index.ts`.
2. **Auth session store + bootstrap** — nothing persists/restores/observes session state yet.
   Files: `src/store/useAuthStore.ts` (new), an `AuthBootstrap` component/hook (new), small edit to
   `src/main.tsx`. Depends on Issue 1.
3. **Auth UI components** (sign-up/sign-in/magic-link/sign-out) — none exist yet.
   Files (new): `src/pages/auth/` or `src/components/auth/` (`AuthForm.tsx`, `EmailPasswordForm.tsx`,
   `MagicLinkForm.tsx`, `SignOutButton.tsx`). Depends on Issue 1 (and reads Issue 2's store).
4. **Wire auth into onboarding + routing** — `WelcomePage`/`OnboardingFlow` have zero backend
   involvement today; no callback route exists for magic links.
   Files: `src/pages/onboarding/WelcomePage.tsx`, `OnboardingFlow.tsx`, `src/App.tsx` (new
   `/auth/callback` route), new `src/pages/auth/AuthCallbackPage.tsx`. Depends on Issue 3.
5. **Store integration: account identity + best-effort `public.users` sync**.
   Files: `src/store/useStore.ts` (additive only), new `src/lib/supabase/accountSync.ts`,
   `src/pages/ProfilePage.tsx` (sign-out control, signed-in state). Depends on Issues 1 and 2.
6. **(Optional/stretch — not required by stated scope)** Wire "Delete account" placeholder in
   `DataSettingsPage.tsx` to `account_deletion_requests`, now that sign-in exists.
   Files: `src/pages/DataSettingsPage.tsx` only. Depends on Issues 1 and 2.

**No two issues touch the same file** — no file-collision-forced sequencing. Logical dependency order:
Issue 1's interfaces should be frozen before 2/3/5 do real integration; 3 before 4; 2 before 5.

- #0001 Supabase client + typed auth wrappers — open
- #0002 Auth session store + bootstrap — open
- #0003 Auth UI components — open
- #0004 Wire auth into onboarding + routing — open
- #0005 Store integration: account identity + public.users sync — open
- #0006 (optional/stretch) Wire "Delete account" to account_deletion_requests — open

## Context summary

All 6 issues' context gathered by parallel Explore agents; no repo facts contradicted the plan.
Cross-cutting findings:

- **Precedent patterns confirmed**: `DEMO_MODE_ENABLED` (useStore.ts:29-30) and `SERVER_STT_CONFIGURED`
  (transcribe.ts:7-9) are the exact existing style `isSupabaseConfigured()` should mirror — no new
  pattern invented. `useOnlineStatus.ts` is the hook-shape precedent for the auth bootstrap.
- **Field mapping gap found**: `public.users.preferred_units` has no `AppUser` counterpart — units live
  on `PatientProfile`, not the account. Solution agent for Issue 5 must decide (mirror active patient's
  units, or omit the column) and document the choice — flagging this now so it isn't silently guessed.
- **`SignOutButton` location resolved**: Issue 3's data collection recommended `src/components/auth/`
  (reusable/presentational, matching `components/ui`, `components/nav` conventions) over
  `src/pages/auth/` for the _components_ — adopting this so Issues 3/4/5/6 agree on the import path.
  (`AuthCallbackPage` itself is a routed screen and correctly stays under `src/pages/auth/`.)
- **No file collisions** — confirmed independently by every data-collection agent; the file-overlap
  check for Stage 3 parallelization is clean as planned.
- **Highest-risk area**: Issue 5 (store integration). Data collection flagged that `enterDemoMode`/
  `exitDemoMode` never touch `currentUser`/`authUserId`, so `accountSync.ts` must re-check
  `viewContext` via `getState()` at every individual Supabase call site — not rely on which store
  fields changed to infer demo state. This is the one place a mistake would violate the CLAUDE.md
  demo-isolation hard rule, and it's called out explicitly in Issue 5's touch-manifest expectations.
- **Dependency order confirmed**: Issue 1 must land first (nothing else has `src/lib/supabase/` yet).
  Issues 2, 3 can scaffold in parallel against Issue 1's frozen interface. Issue 4 needs Issue 3;
  Issue 5 needs Issues 1 and 2; Issue 6 needs Issues 1 and 2.

## Final summary

All 6 issues resolved, each independently typecheck/lint clean; final repo-wide verification
(`npm run typecheck`, `npm run lint`, `npm run test`) passes with 46/46 tests green.

- **#0001** `src/lib/supabase/{client,auth,session,index}.ts` (new) — Supabase client singleton +
  normalized auth wrappers (`signUpWithPassword`, `signInWithPassword`, `signInWithMagicLink`,
  `signOut`, `getSession`, `subscribeToAuthChanges`). Never throws when unconfigured.
- **#0002** `src/store/useAuthStore.ts`, `src/hooks/useAuthBootstrap.ts`,
  `src/lib/supabase/AuthBootstrap.tsx` (new), `src/main.tsx` (edit) — non-persisted session store
  (`session`, `user`, `status`, `setSession`) bootstrapped once at app start.
- **#0003** `src/components/auth/{EmailPasswordForm,MagicLinkForm,SignOutButton,index}.tsx` (new) —
  presentational auth UI on the existing design system, no OAuth UI yet by design.
- **#0004** `src/pages/onboarding/{WelcomePage,OnboardingFlow}.tsx` (edit), `src/App.tsx` (edit, new
  public `/auth/callback` route), `src/pages/auth/AuthCallbackPage.tsx` (new) — sign-in surfaced as an
  optional path; `RequireOnboarding.tsx` untouched, local/offline usage unaffected.
- **#0005** `src/store/useStore.ts` (additive: `authUserId`, `linkAuthAccount`/`unlinkAuthAccount`),
  `src/lib/supabase/accountSync.ts` (new) — best-effort `public.users` sync, `preferred_units` mirrors
  the active patient's units (documented, no canonical account-level field exists). Demo-mode isolation
  guard (`isSupabaseConfigured() && useStore.getState().viewContext === "live"`) verified independently
  by the main agent (not just the solution agent's own report) to be re-checked live at the single
  Supabase call site in `upsertUserRow`. `enterDemoMode`/`exitDemoMode` confirmed byte-for-byte
  unchanged. `ProfilePage.tsx` sign-out confirmed to call only `unlinkAuthAccount()`, never a
  destructive action.
- **#0006** `src/pages/DataSettingsPage.tsx` (edit) — "Delete account" now inserts into
  `account_deletion_requests`, gated on `useAuthStore().status === "signed-in"`, unchanged placeholder
  otherwise.

**Explicitly not built** (by design, per the approved plan): Google/OAuth UI (user configuring
separately), sync of profiles/fluid_events/containers/etc. to Postgres (future initiative).

**Infra state**: Supabase project `JunoxAntropic` (ref `grrnujftjleisbjndlwg`) has the full schema
applied (0001_init + a search_path security fix), zero security lints. `.env.local` configured.
Nothing has been pushed to git yet — this workflow only edits/creates files, per its own rules.

**Addendum (2026-07-25, done directly, no agents)**: user decided sign-in should be mandatory for
live usage, not optional as originally approved/built. Changed `RequireOnboarding.tsx` to redirect to
`/welcome` when `viewContext === "live"` and not signed in (demo mode stays exempt, unchanged).
Updated `WelcomePage.tsx` to handle the "onboarded but signed out" case without a redirect loop
(hides "Get started", auto-expands sign-in, updated copy) and `OnboardingFlow.tsx`'s account-creation
step copy (no longer says "optional"). Updated CLAUDE.md's Stack section to reflect that backend/auth
is now required for live usage, with demo mode as the sole exception. Verified clean:
`npm run typecheck`, `npm run lint`, `npm run test`.
