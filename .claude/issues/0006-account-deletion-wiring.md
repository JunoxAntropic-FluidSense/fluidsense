# Issue #0006: Wire "Delete account" to account_deletion_requests (optional/stretch)

- Parent contract: supabase-auth
- Status: resolved
- Created: 2026-07-25

## Problem

`src/pages/DataSettingsPage.tsx` already has a "Delete account" card with placeholder copy noting
deletion "will be available once sign-in is enabled." Now that sign-in exists, wire it to the
already-modeled `account_deletion_requests` table.

## Acceptance criteria

- [ ] Replace the placeholder copy/action in `src/pages/DataSettingsPage.tsx` with a real action that
      inserts a row into `public.account_deletion_requests` (insert-only from the client per its RLS
      policy — actual erasure is handled by a service-role process elsewhere, out of scope here).
- [ ] Action must be gated behind being signed in (`useAuthStore`) and must clearly communicate this
      is a _request_, not immediate deletion — no diagnostic/clinical language, plain description of
      what happens (CLAUDE.md hard rule).
- [ ] If not signed in, keep the existing placeholder behavior — do not regress the unauthenticated
      experience.
- [ ] Only touch `src/pages/DataSettingsPage.tsx`.

## Context

**Current placeholder in `src/pages/DataSettingsPage.tsx` (full file read, 262 lines) — exact copy/code to replace:**

```tsx
<Card className="p-5">
  <CardHeading>Delete account</CardHeading>
  <p className="text-sm text-fog-600">
    Permanent account deletion will be available once sign-in is enabled for{" "}
    {currentUser.displayName || "this account"}. For now, use "Reset FluidSense
    account" above to remove all local data.
  </p>
</Card>
```

This card has no `Button` and no `confirmStep` case today — it is pure static copy, unlike the other
five distinct, clearly-labeled data-settings actions in this file (start new day, monitoring-day start
time, clear today's entries, delete all fluid data, reset FluidSense account — per `APP_PLAN.md` line 45).
`currentUser` comes from `useStore((s) => s.currentUser)` (local app-data store, not the auth store) and
is only used here for the display-name interpolation; it has no sign-in concept itself. `confirmStep`
state (`null | "startDay" | "clearToday" | "deleteAll" | "resetAccount"`) and the `ConfirmModal` component
(props: `title`, `body`, `confirmLabel`, `onConfirm`, `onCancel`, `danger?`, `requireText?`, `textValue?`,
`onTextChange?`) are the existing pattern for "distinct, clearly-labeled" destructive actions with a
danger-styled `Button` (`variant="danger"`) opening a modal — a new `"deleteAccount"` case would follow
this same shape (new `confirmStep` union member + new `{confirmStep === "deleteAccount" && <ConfirmModal .../>}`
block), matching the danger-bordered card styling (`className="p-5 border-2 border-alert-100"`) used by
"Delete all fluid data" and "Reset FluidSense account".

**`account_deletion_requests` table (`supabase/migrations/0001_init.sql` lines 278-290):**

```sql
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  request_time timestamptz not null default now(),
  completion_status text not null default 'pending' check (completion_status in ('pending', 'completed', 'cancelled'))
);
alter table public.account_deletion_requests enable row level security;
create policy "users can create their own deletion request" on public.account_deletion_requests
  for insert with check (auth.uid() = user_id);
create policy "users can view their own deletion request" on public.account_deletion_requests
  for select using (auth.uid() = user_id);
```

Only `insert` (own row, `user_id = auth.uid()`) and `select` (own rows) policies exist — no `update`/
`delete` policy, so the client can create a request and optionally read it back, but cannot cancel or
mark it complete itself; that must happen out-of-band via a service-role process (confirmed out of scope
by this issue's acceptance criteria). `user_id` has no default — the insert payload must explicitly set
`user_id` to the signed-in user's id (from the auth session), since there's no `auth.uid()` column
default here (unlike `public.users.id` which references `auth.users` directly).

**Issue 1 (`0001-supabase-client-auth-wrappers.md`) contract — not yet implemented on disk
(`src/lib/supabase/` does not exist yet; confirmed via `ls`):**

- `src/lib/supabase/client.ts` will export `supabase: SupabaseClient | null` and
  `isSupabaseConfigured(): boolean` — this issue's insert call must go through `supabase` (null-checked)
  from this module, not construct its own client.
- `src/lib/supabase/index.ts` is the barrel export — prefer importing `supabase` from
  `../lib/supabase` (barrel) per that issue's own stated convention.
- Auth wrappers (`signUpWithPassword`, etc., in `auth.ts`) are not needed for this issue — only the raw
  `supabase` client for the `.from("account_deletion_requests").insert(...)` call.

**Issue 2 (`0002-auth-session-store-bootstrap.md`) contract — not yet implemented on disk
(`src/store/useAuthStore.ts` does not exist yet):**

- `src/store/useAuthStore.ts` will be a new, non-persisted zustand store (sibling to `src/store/useStore.ts`,
  no `persist` middleware) holding session/user/status, where status is
  `"loading" | "signed-in" | "signed-out"`.
- This issue's gating logic ("Action must be gated behind being signed in") should read the `status`
  field from `useAuthStore` and treat only `"signed-in"` as eligible for the real action — `"loading"`
  and `"signed-out"` should behave like today's placeholder (no regression per acceptance criteria).
- The signed-in user's id for the `user_id` insert column should come from `useAuthStore`'s `user`/
  `session` field (exact shape not yet finalized by Issue 2 — likely a Supabase `User` object exposing
  `.id`), not from `useStore`'s `currentUser` (which is local app-profile state, unrelated to Supabase
  auth identity).

**CLAUDE.md hard rule (Hard rule #2, "No diagnostic or clinical-decision language, anywhere"):** applies
to this card's copy generally (no diagnostic language risk here, but the broader plain-language mandate
applies) — combined with the acceptance criteria's own requirement that copy "clearly communicate this is
a _request_, not immediate deletion." Existing sibling cards model the right tone: plain, concrete,
outcome-first sentences ("Deletes only entries in the active monitoring day...", "Removes all N intake
and output events..., Your profile... are kept.", "Deletes all fluid events... then returns you to
onboarding.") — no hedging, no jargon, states exactly what will and won't happen. A new "Delete account"
copy should follow this pattern, e.g. stating plainly that a deletion request will be recorded/submitted
and processed separately, rather than deleting anything immediately.

## Touch manifest

- `src/pages/DataSettingsPage.tsx` only:
  - Add imports: `useAuthStore` from `../store/useAuthStore`, `supabase` from `../lib/supabase` (barrel).
  - Add `"deleteAccount"` to the `confirmStep` union.
  - Read `status` and `user` from `useAuthStore`.
  - Add local state for request submission (pending/error) so the confirm action can await the insert
    and surface a failure without navigating away.
  - Replace the static "Delete account" card: when `status === "signed-in"`, render the danger-styled
    card/button/`ConfirmModal` pattern (matching "Delete all fluid data" / "Reset FluidSense account"
    styling — `border-2 border-alert-100`, `variant="danger"`); when not signed in, render the existing
    placeholder copy/behavior unchanged.
  - Add the `{confirmStep === "deleteAccount" && <ConfirmModal ... />}` block performing
    `supabase.from("account_deletion_requests").insert({ user_id: user.id })`.

## Resolution

Implemented the real "Delete account" action in `src/pages/DataSettingsPage.tsx`, gated on
`useAuthStore().status`:

- **Signed in** (`status === "signed-in"`): renders the same danger-card pattern as the sibling
  "Delete all fluid data" / "Reset FluidSense account" cards — `border-2 border-alert-100`,
  `variant="danger"` `Button` opening a `ConfirmModal` (`requireText="DELETE"`, matching the
  highest-severity siblings). Copy states plainly: "This submits a request to delete your account.
  It does not delete anything immediately — your data stays as-is until the request is processed
  separately. You'll remain signed in until then." On confirm, inserts
  `{ user_id: user.id }` into `public.account_deletion_requests` via the barrel-exported `supabase`
  client (null-checked; `user` is guaranteed non-null when `status === "signed-in"` per
  `useAuthStore.setSession`). Handles the insert asynchronously: disables the confirm button while
  pending and shows an inline error in the modal on failure instead of silently closing/navigating.
  On success, closes the modal and shows a brief inline confirmation on the card itself (no navigation
  away, since the user stays signed in and the account still functions until processed).
- **Loading / signed-out**: unchanged placeholder copy and no button — exact prior behavior, no
  regression.

No diagnostic/clinical language used; tone matches sibling cards (plain, outcome-first, states what
does and doesn't happen).

Files touched: `src/pages/DataSettingsPage.tsx` only (plus this issue file for the manifest/resolution
sections).

Verification: `npm run typecheck` and `npm run lint` both clean repo-wide (see command output in the
session — no errors).

Status: resolved
