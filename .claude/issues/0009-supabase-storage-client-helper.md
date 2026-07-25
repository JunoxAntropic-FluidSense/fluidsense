# Issue #0009: Supabase Storage client helper

- Parent contract: camera-drink-photos
- Status: open
- Created: 2026-07-25

## Problem

No client-side helper exists to upload a photo to Supabase Storage or generate a signed URL to
display it later.

## Acceptance criteria

- [ ] `src/lib/photo/storage.ts` exports an upload function (path convention keyed by event id,
      bucket name matching #0007's migration) and a signed-URL retrieval function.
- [ ] Gracefully handles "Supabase not configured" — returns a typed, catchable result/error rather
      than throwing an uncaught exception — consistent with the app running fully client-side without
      a backend.
- [ ] No secrets embedded in client code; uses only the public anon key via existing `VITE_`-prefixed
      env var conventions. If no Supabase client wrapper exists yet in `src/`, this issue creates the
      minimal one needed (coordinate scope with what #0007's migration expects).

## Context

### Existing Supabase client wrapper (reuse, do not recreate)

`src/lib/supabase/client.ts` already exports a configured singleton: `export const supabase:
SupabaseClient | null` (null when unconfigured) and `isSupabaseConfigured(): boolean`, computed at
module scope directly from `import.meta.env.VITE_SUPABASE_URL` / `import.meta.env.VITE_SUPABASE_ANON_KEY`
(declared in `src/vite-env.d.ts`, documented in `.env.example:12-13`). No new client module is needed —
this issue's scope is `src/lib/photo/storage.ts` only, importing `{ supabase } from "../supabase/client"`
(or the barrel `../supabase`). The acceptance criterion about creating a client "if none exists" does not
apply; a wrapper already exists and must be reused, not duplicated.

Follow the typed-result idiom already established in `src/lib/supabase/auth.ts`: every exported function
checks `if (!supabase) return { ...NOT_CONFIGURED_ERROR }` (define a local `NOT_CONFIGURED_ERROR`, e.g.
`{ message: "Supabase is not configured." }`) before calling any Supabase method, and normalizes SDK
errors into a plain `{ message: string }` shape — never let a raw `StorageError` or thrown exception
escape. `src/lib/supabase/session.ts` shows the same `if (!supabase) { ... }` guard pattern for read-style
calls.

### Bucket name and path convention (from #0007)

Issue #0007's migration (`supabase/migrations/0002_drink_photos.sql`, not yet merged as of this writing)
defines bucket name `drink-photos` (private, RLS scoped via `profiles.owner_user_id`) and object path
convention `<profileId>/<eventId>.jpg`. Use these exact values/format in `storage.ts` — do not invent a
different bucket name or path shape. `FluidEvent.photoStoragePath` (added by #0007 in `src/types.ts`) is
expected to store this same path string.

### API shape to implement

Use the supabase-js v2 Storage API directly via the singleton, matching the SDK usage style already used
in `src/lib/supabase/auth.ts`/`session.ts` (e.g. `supabase.storage.from("drink-photos").upload(path,
file, { upsert: true })` for upload, `supabase.storage.from("drink-photos").createSignedUrl(path,
expiresInSeconds)` for retrieval) — no raw `fetch()` needed for Storage (unlike
`src/lib/voice/transcribe.ts`, which uses `fetch()` only because it targets a separate Edge Function URL,
not the Storage API).

### Env vars (exact names)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — both already declared in `src/vite-env.d.ts` and
`.env.example`. No new env vars are needed for this issue.

### Directory

`src/lib/photo/` does not exist yet; this issue creates it (containing `storage.ts`). This is
intentionally separate from both `src/store/useStore.ts` (persistence/demo-mode only, per CLAUDE.md) and
`src/lib/supabase/` (existing client/auth layer, which storage.ts imports from but should not be modified
by this issue beyond adding new imports/usages).

## Touch manifest

- `src/lib/photo/storage.ts` (new) — bucket constant, `NormalizedStorageError`/`UploadPhotoResult`/
  `SignedPhotoUrlResult` types, `buildPhotoStoragePath(profileId, eventId)`, `uploadDrinkPhoto(profileId,
eventId, file)`, `getDrinkPhotoSignedUrl(path, expiresInSeconds?)`. Imports `{ supabase }` from
  `../supabase/client` only — no other files touched.

## Resolution

Created `src/lib/photo/storage.ts`, importing `{ supabase }` from the existing
`../supabase/client` singleton (not modified, not duplicated). Exports:

- `buildPhotoStoragePath(profileId, eventId)` — `<profileId>/<eventId>.jpg`, matching #0007's
  convention exactly.
- `uploadDrinkPhoto(profileId, eventId, file)` — uploads to the private `drink-photos` bucket at
  that path with `{ upsert: true, contentType: "image/jpeg" }`; returns `UploadPhotoResult`
  (`{ path: string | null; error: NormalizedStorageError | null }`).
- `getDrinkPhotoSignedUrl(path, expiresInSeconds = 3600)` — returns `SignedPhotoUrlResult`
  (`{ signedUrl: string | null; error: NormalizedStorageError | null }`).

Both functions guard `if (!supabase) return { ..., error: NOT_CONFIGURED_ERROR }` before touching
the SDK, and both route through `normalizeError()` so a raw `StorageError` never escapes — mirrors
the idiom in `src/lib/supabase/auth.ts` / `session.ts`. No diagnostic/clinical language; no secrets
(only the existing `supabase` singleton, itself built from `VITE_`-prefixed env vars, is used).

`npm run build` (`tsc -b && vite build`) passed with no errors.
