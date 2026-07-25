# Issue #0005: Store integration — account identity + best-effort public.users sync

- Parent contract: supabase-auth
- Status: resolved
- Created: 2026-07-25

## Problem

`useStore.ts` has no notion of an authenticated identity, and nothing pushes/pulls the `public.users`
row. This is the one piece of "real user data" this task syncs — scope stops there (no
profiles/fluid_events/etc. sync in this task).

## Acceptance criteria

- [x] `src/store/useStore.ts` gets `authUserId: string | null` plus `linkAuthAccount` /
      `unlinkAuthAccount` actions — additive only, same shape/style as existing actions in the file.
      Do NOT rewrite or restructure the existing persistence logic.
- [x] New `src/lib/supabase/accountSync.ts` — subscribes to `useAuthStore` (Issue 2) and `useStore`,
      and best-effort (try/catch, non-blocking, must never throw uncaught) upserts/fetches the
      `public.users` row (display name, role, mode, timezone, preferred_units, onboarding_completed,
      save_voice_transcripts) when signed in.
- [x] **Hard rule**: every Supabase call in `accountSync.ts` must be guarded by
      `isSupabaseConfigured() && useStore.getState().viewContext === "live"`. Demo mode
      (`viewContext === "demo"`) must NEVER touch Supabase, under any code path — this is a CLAUDE.md
      hard rule, not a style preference. Verify `enterDemoMode`/`exitDemoMode` remain untouched.
- [x] `src/pages/ProfilePage.tsx` — wire in Issue 3's `SignOutButton` and show signed-in state
      (e.g. the account email, a "Sign in" prompt if not signed in).
- [x] Signing out must never delete or block access to local data — only stops cloud sync.

## Context

**`AppUser` shape (`src/types.ts:18-27`)**: `id: string`, `displayName: string`, `role: Role`,
`mode: Mode`, `accessibility: AccessibilityPrefs`, `onboardingCompleted: boolean`, `timezone: string`,
`saveVoiceTranscripts: boolean`. No `preferred_units`/units field on `AppUser` — units live per-patient
on `PatientProfile.units` (`src/types.ts:227`), not on the account. `Mode = "patient"|"healthcare"`,
`Role = "patient"|"family_carer"|"nurse"|"healthcare_assistant"|"clinician"` — both match
`public.users.mode`/`.role` check constraints in `supabase/migrations/0001_init.sql:14-16` exactly (no
value-set mismatch).

**Field mapping vs `public.users` (`0001_init.sql:11-22`)** — camelCase → snake_case, all straight
1:1 except one gap:

- `displayName` → `display_name`, `role` → `role`, `mode` → `mode`, `timezone` → `timezone`,
  `onboardingCompleted` → `onboarding_completed`, `saveVoiceTranscripts` → `save_voice_transcripts`: direct.
- `preferred_units` has **no AppUser counterpart** — nearest source is the active patient's
  `PatientProfile.units`. accountSync.ts must explicitly decide and document which patient's units it
  mirrors (or omit the column safely) rather than assuming a 1:1 field.
- `public.users.id` is `references auth.users(id)` — it must equal the Supabase auth uid, NOT
  `currentUser.id` (which is a locally-generated uuid, e.g. `"local-user"` before onboarding, or
  `uuid()` from `completeOnboarding`/`resetAccount`). This is exactly why `authUserId` must be a
  separate field. Confirmed via grep: `currentUser.id` has no other readers anywhere in `src/` outside
  `useStore.ts`, so adding `authUserId` alongside it is safe.

**Demo-mode isolation mechanism (`src/store/useStore.ts`)**:

- `viewContext: "live" | "demo"` (line 53) is the single source of truth for demo state.
- `_liveCache: LiveSnapshot | null` (line 54) holds the pre-demo live slice (patients, fluidProfiles,
  events, weightEvents, symptomEvents, monitoringPeriods, activePatientId) while `demo` is active.
- `enterDemoMode()` (lines 353-378): gated by `DEMO_MODE_ENABLED`; no-ops if already `"demo"`; stashes
  the live slice into `_liveCache`, loads `generateDemoData()` output, sets `mode: "patient"`
  unconditionally. **`currentUser` (and thus `authUserId`) is untouched** by entering/exiting demo — it
  is not part of `LiveSnapshot` and is never swapped.
- `exitDemoMode()` (lines 380-390): restores `_liveCache` (falling back to `emptyLiveSnapshot`), resets
  `mode` from `currentUser.mode`.
- `partialize` in the persist config (lines 688-706): when `viewContext === "demo"`, persists the
  cached _live_ data, never the demo dataset. Any new persisted field (e.g. `authUserId`, if it should
  survive reload) must be added explicitly to this `partialize` return object — it's an allowlist, not
  automatic.

**Existing action style to match**: plain arrow-function properties, either `set((s) => ({...}))`
spread-updating `currentUser` (see `setUserRole`, `setAccessibility`, `setSaveVoiceTranscripts`, lines
402-422) or a `get()`-then-`set()` guarded pair (see `enterDemoMode`/`exitDemoMode`).
`linkAuthAccount`/`unlinkAuthAccount` should follow the latter pattern; section-comment headers
(`// --- ... ---`) group related actions throughout — add these under a new or existing header near
account/onboarding lifecycle actions.

**`ProfilePage.tsx` structure**: reads store via individual `useStore((s) => ...)` selectors (`mode`,
`viewContext`, `exitDemoMode`, `currentUser`, `setUserRole`, etc., lines 29-38); returns null if no
active patient (line 44). The existing demo-mode banner (lines 57-72, `viewContext === "demo"`
conditional `Card`) is the natural precedent for a new signed-in/sign-out `Card` — place it near that
banner. Currently zero references to auth anywhere in this file.

**Dependencies (exact promised exports)**: Issue 1's `client.ts` (`supabase`, `isSupabaseConfigured()`),
`auth.ts` (normalized wrappers), `session.ts` (`getSession`, `subscribeToAuthChanges`) — **none of
`src/lib/supabase/` exists yet**, this issue is blocked on Issue 1 landing first. Issue 2's
`useAuthStore` — a non-persisted store with `status: "loading"|"signed-in"|"signed-out"` (exact
additional field names not pinned down yet; verify once Issue 2 lands rather than assuming). Issue 3's
`SignOutButton` path (`src/pages/auth/` vs `src/components/auth/`) isn't pinned down yet either.

**Risk flags for demo-mode isolation (highest priority in this whole task)**:

1. The guard `isSupabaseConfigured() && useStore.getState().viewContext === "live"` must be checked
   **inside every individual Supabase call site in accountSync.ts, at call time** — not once at
   subscription setup. A zustand `subscribe` callback fires on any store change; a subscriber that
   captures `viewContext` once rather than re-reading it live via `getState()` on every invocation could
   fire mid-demo-transition.
2. `currentUser`/`authUserId` are never swapped by `enterDemoMode`/`exitDemoMode` — good for isolation,
   but means accountSync cannot use `currentUser` changes as a signal that demo mode started/stopped; it
   must read `viewContext` explicitly, every time.
3. Verify `enterDemoMode`/`exitDemoMode` remain byte-for-byte untouched — only additive fields/actions
   elsewhere in the file are in scope for this issue.
4. Sign-out (Issue 3's `SignOutButton` → Issue 1's `signOut()` → this issue's `unlinkAuthAccount`) must
   only clear `authUserId`/stop sync — never call `resetAccount()` or `deleteAllFluidData()`; local data
   must survive sign-out per the acceptance criteria.

## Touch manifest

- `src/store/useStore.ts` — additive only:
  - `authUserId: string | null` field on `StoreState`, initialized to `null`, placed next to `_liveCache`.
  - `linkAuthAccount(authUserId: string)` / `unlinkAuthAccount()` actions, `get()`-then-`set()` guarded
    pattern matching `enterDemoMode`/`exitDemoMode`, under a new `// --- auth account linking
(Supabase) ---` header.
  - `authUserId` added explicitly to the `partialize` return object (persisted, same treatment as
    `currentUser`/`mode` — see Resolution for why).
  - `enterDemoMode`/`exitDemoMode` bodies untouched (verified byte-for-byte after edit).
- `src/lib/supabase/accountSync.ts` (new) — subscribes to `useAuthStore` + `useStore`; every Supabase
  call re-checks `isSupabaseConfigured() && useStore.getState().viewContext === "live"` at call time via
  `getState()`.
- `src/lib/supabase/index.ts` — barrel export addition: `startAccountSync`/`stopAccountSync` from the
  new file. Additive, one line.
- `src/lib/supabase/AuthBootstrap.tsx` — minimal necessary wiring beyond the three files named in the
  issue: calls `startAccountSync()` once alongside the existing `useAuthBootstrap()` call, otherwise the
  new subscriptions in `accountSync.ts` are defined but never started and the feature is inert. Kept to
  a two-line addition (import + call) in the file whose entire purpose is already "run subscription
  setup at the top of the tree" for the sibling auth-session concern.
- `src/pages/ProfilePage.tsx` — signed-in banner (email, `SignOutButton` wired to `unlinkAuthAccount`)
  and a "not signed in" prompt, placed near the existing demo-mode `Card`. No new routes referenced (no
  `/auth`-style sign-in route exists yet in `App.tsx` — out of scope here).

## Resolution

**Demo-mode isolation — the guard, quoted verbatim:**

`src/lib/supabase/accountSync.ts` has exactly one function that ever touches Supabase:
`upsertUserRow(authUserId)`. Its first line is:

```ts
if (!canSyncNow()) return;
```

where

```ts
function canSyncNow(): boolean {
  return isSupabaseConfigured() && useStore.getState().viewContext === "live";
}
```

`useStore.getState()` is called fresh, synchronously, at the moment `upsertUserRow` executes — never
via a value captured by the `useAuthStore.subscribe`/`useStore.subscribe` callbacks that invoke it
(`handleAuthChange`, `handleStoreChange`). Both call sites (`void upsertUserRow(...)` in
`handleAuthChange` and in `handleStoreChange`) call it unconditionally and rely entirely on this
internal, call-time guard — there is no pre-filtering by viewContext at the subscriber level that could
go stale. Because `enterDemoMode`/`exitDemoMode` update `viewContext` atomically together with
`patients`/`activePatientId` inside a single `set()` call, there is no intermediate tick where a
subscriber could observe demo data alongside `viewContext: "live"` (zustand notifies subscribers only
after a `set()` call fully lands, so `patients` and `viewContext` always flip together, never
straddled). `enterDemoMode`/`exitDemoMode` bodies were left byte-for-byte identical to the pre-existing
code (confirmed by re-reading the file after editing) — only the new `authUserId` field and
`linkAuthAccount`/`unlinkAuthAccount` actions were added elsewhere in the file, and `authUserId` is
never referenced by either function.

`linkAuthAccount`/`unlinkAuthAccount` themselves never touch Supabase — they're pure local `useStore`
setters (get-then-set guarded, matching `enterDemoMode`/`exitDemoMode`'s style) that only track _who is
signed in_, independent of `viewContext`. This is intentional: a signed-in user browsing demo mode stays
"signed in" (per Context risk #2, `authUserId` is not swapped by demo transitions), but that identity
bookkeeping alone never reaches the network — only `upsertUserRow` does, and it re-checks live.

**`preferred_units` mapping decision:** `AppUser` has no units field of its own (confirmed in
`src/types.ts`); units live per-patient on `PatientProfile.units`. `accountSync.ts`'s
`activePatientUnits(state)` mirrors the currently active patient's units
(`state.patients.find(p => p.id === state.activePatientId)?.units`), falling back to `"mL"` if no
active patient exists yet (e.g. immediately post-sign-in, pre-onboarding). This is a best-effort,
display-oriented mirror only — never read back into patient state, and it does not retroactively affect
history if the active patient changes later.

**`authUserId` persistence decision:** added to the `partialize` allowlist (persisted), matching how
`currentUser` is already persisted despite also being untouched by demo transitions. This avoids a
flash of "not signed in" in `ProfilePage` immediately after reload while `useAuthBootstrap`'s
`getSession()` call is still in flight; any staleness is self-correcting within one bootstrap round-trip
since `accountSync.startAccountSync()` immediately calls `handleAuthChange()` once on start and stays
subscribed to every subsequent `useAuthStore` change.

**Wiring beyond the three files named in the issue:** `accountSync.ts`'s subscriptions are inert until
something calls `startAccountSync()`. Added a two-line call (inside a `useEffect`, alongside the
existing `useAuthBootstrap()` call) to `src/lib/supabase/AuthBootstrap.tsx` — the file whose entire
purpose is already "run auth-adjacent subscription setup at the top of the tree" — plus a one-line
barrel export in `src/lib/supabase/index.ts`. `src/main.tsx` was not touched.

**Sign-out:** `ProfilePage`'s `SignOutButton onSignOut={() => unlinkAuthAccount()}` and
`accountSync.ts`'s own sign-out handling (`handleAuthChange` calling `unlinkAuthAccount()` when
`useAuthStore` reports `"signed-out"`) both only clear `authUserId` / stop sync bookkeeping. Neither
path calls `resetAccount()` or `deleteAllFluidData()` — local data is untouched by sign-out.

**Verification:** `npm run build` (tsc -b + vite build) clean; `npm run lint` clean (two pre-existing
`react-hooks/exhaustive-deps` warnings in `useFluidData.ts`, unrelated to this change); `npm run test`
36/36 passing across all 4 suites, unchanged.
