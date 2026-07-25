# Issue #0007: Add photo fields to data model + Storage migration

- Parent contract: camera-drink-photos
- Status: open
- Created: 2026-07-25

## Problem

`FluidEvent` has no field to reference an attached photo, and there is no Supabase Storage bucket or
RLS policy for drink photos.

## Acceptance criteria

- [ ] `FluidEvent` (src/types.ts) gains additive optional field(s): `photoStoragePath?: string` and
      `photoSource?: "attached" | "ai_estimate"` (or similar) — no existing fields changed/removed.
- [ ] New migration `supabase/migrations/0002_drink_photos.sql` creates a private (not public)
      Supabase Storage bucket for drink photos, with RLS policies scoped to `auth.uid()` following the
      ownership pattern already established in `0001_init.sql`.
- [ ] If photo metadata should be mirrored server-side, migration adds nullable column(s) to
      `fluid_events` consistent with existing table conventions.
- [ ] No changes to `MeasurementStatus` or any status-determining logic.
- [ ] No diagnostic/clinical language in column/policy names or comments.

## Context

### `FluidEvent` (src/types.ts:106-133)

Optional fields follow a flat, no-nesting convention (e.g. `containerId?: string`,
`fluidProfileId?: string`, `note?: string`) with camelCase names and inline comments only where the
purpose isn't obvious from the name. `MeasurementStatus` (src/types.ts:31-32) and
`NUMERIC_STATUSES` (src/types.ts:42-46) are untouched by this issue — do not add photo fields there.
Insert new optional photo fields near the end of `FluidEvent`, after `confidence?: number;`
(src/types.ts:132) and before the closing `}` (src/types.ts:133), e.g.:

```ts
photoStoragePath?: string; // Supabase Storage object path, e.g. `<profileId>/<eventId>.jpg`
photoSource?: "attached" | "ai_estimate";
```

No other interface needs changes; `BalanceBreakdown`, `EditRecord`, etc. are unrelated.

### `supabase/migrations/0001_init.sql` conventions

- One `create table if not exists public.<snake_case_plural>` block per table, columns snake_case,
  `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`.
- `public.fluid_events` (0001_init.sql:141-169) is the table to extend if server-side photo metadata
  is mirrored. It already has `profile_id`, `event_time`, `measurement_status`
  (check-constrained to the same 4 values as `MeasurementStatus` — do not touch this constraint),
  and an `updated_at` column maintained by the `set_updated_at()` trigger
  (0001_init.sql:295-306, trigger at 305-307). Any new nullable column(s), e.g.
  `photo_storage_path text` / `photo_source text check (photo_source in ('attached',
'ai_estimate'))`, should be added via `alter table public.fluid_events add column if not exists ...`
  in the new `0002_drink_photos.sql`, not by editing `0001_init.sql`.
- Ownership/RLS pattern used everywhere except `public.users` and
  `account_deletion_requests`: tables that hang off `profile_id` enable RLS
  (`alter table public.<t> enable row level security;`) and use a single `for all` policy checking
  `exists (select 1 from public.profiles p where p.id = profile_id and p.owner_user_id = auth.uid())`
  in both `using` and `with check` (see e.g. 0001_init.sql:175-180 for `fluid_events`). A new Storage
  bucket's RLS policies (on `storage.objects`) should follow the same "owner via profiles" shape,
  scoped by matching the object path's leading segment (e.g. profile id or event id) against a row the
  requesting `auth.uid()` owns — mirror the `edit_history` pattern (0001_init.sql:198-211) of joining
  through to `profiles.owner_user_id` if the path encodes an event id rather than profile id directly.
- No Storage bucket exists yet anywhere in the repo (confirmed via grep for "storage"/"bucket"/
  `.storage.from` across `src/` and `supabase/` — only doc/comment mentions of "localStorage" and
  Supabase-as-optional-backend). This issue creates the first one.
- Only migration file present is `0001_init.sql`; this issue's migration must be named
  `supabase/migrations/0002_drink_photos.sql` (per acceptance criteria) and follow the same
  header-comment style (0001_init.sql:1-4).

### Backend-optional constraint

`src/lib/supabase/client.ts` (see comment at top) establishes that Supabase is optional — the app
must run fully client-side without it. This issue only touches types + SQL migration (no client code
per se), but keep in mind sibling issues #0009 (`src/lib/photo/storage.ts`) will read the bucket name
this migration defines, so pick a clear, stable bucket name (e.g. `drink-photos`) and state it
explicitly in the migration's header comment so #0009 doesn't need to re-derive it.

### Naming/tone constraint

Existing schema and code deliberately avoid clinical/diagnostic language (e.g. `measurement_status`,
not "accuracy"; `contact_instructions`, not anything clinical). Keep new column/policy/bucket names
neutral (e.g. `photo_storage_path`, `photo_source`, bucket `drink-photos`) — no words implying
medical diagnosis or assessment.

## Touch manifest

- `src/types.ts` — lines 132-133 (inside `FluidEvent`, after `confidence?: number;` and before the
  closing `}`): insert two additive optional fields, `photoStoragePath?: string` and
  `photoSource?: "attached" | "ai_estimate"`. No other lines in this file touched.
- `supabase/migrations/0002_drink_photos.sql` — new file. Contents: header comment stating the bucket
  name (`drink-photos`) for #0009; `insert into storage.buckets (...)` creating the private bucket;
  RLS policy/policies on `storage.objects` scoped to the object path's leading segment (profile id)
  matched against `public.profiles` owned by `auth.uid()`; `alter table public.fluid_events add column
if not exists photo_storage_path text` and `... add column if not exists photo_source text check
(photo_source in ('attached', 'ai_estimate'))`. No edits to `0001_init.sql`.

## Resolution

- `src/types.ts:132-135` — added `photoStoragePath?: string` and
  `photoSource?: "attached" | "ai_estimate"` to `FluidEvent`, immediately after `confidence?: number;`
  and before the closing `}`. Purely additive; no other fields, interfaces, `MeasurementStatus`, or
  `NUMERIC_STATUSES` touched.
- `supabase/migrations/0002_drink_photos.sql` — new file:
  - Header comment names the bucket (`drink-photos`) explicitly for #0009 to consume.
  - `insert into storage.buckets (id, name, public) values ('drink-photos', 'drink-photos', false)`
    (with `on conflict (id) do nothing` for idempotent re-runs) creates the private bucket.
  - A single `for all` RLS policy on `storage.objects`, scoped to `bucket_id = 'drink-photos'`, matches
    the object path's leading segment (`(storage.foldername(name))[1]`, i.e. the profile id, per the
    `<profileId>/<eventId>.jpg` path convention) against `public.profiles` rows owned by `auth.uid()` —
    same "owner via profiles" shape as `fluid_events`/`containers`/etc. in `0001_init.sql`.
  - `alter table public.fluid_events add column if not exists photo_storage_path text` and
    `... add column if not exists photo_source text check (photo_source in ('attached',
'ai_estimate'))` mirror the new client fields server-side. The existing `measurement_status` check
    constraint and all other columns are untouched.
  - No changes made to `0001_init.sql`.
- Naming check: `photo_storage_path`, `photo_source`, and bucket `drink-photos` — no diagnostic/clinical
  language anywhere in names or comments.
- Tests/build: `npx tsc -b` and `npm run build` both pass with no errors (only Vite's pre-existing
  "chunk larger than 500 kB" advisory, unrelated to this change). No SQL was executed against a live
  database, per the task instructions — the migration was checked for syntactic/stylistic consistency
  with `0001_init.sql` only.
