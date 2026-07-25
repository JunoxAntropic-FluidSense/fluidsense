# Issue #0011: Client estimate module

- Parent contract: camera-drink-photos
- Status: open
- Created: 2026-07-25

## Problem

No client-side function exists to call the `estimate-volume` Edge Function or handle its
unavailability gracefully.

## Acceptance criteria

- [ ] `src/lib/photo/estimateVolume.ts` exports a function that POSTs a compressed image to the
      `estimate-volume` Edge Function and returns the typed closed-schema response from #0010.
- [ ] Returns a typed "unavailable" result (not a thrown crash) when Supabase isn't configured,
      mirroring how voice's browser-STT fallback signals unavailability.
- [ ] Response typing matches #0010's schema exactly — no free-text field consumed or surfaced.
- [ ] Network/Edge Function errors surface as a generic, non-diagnostic message.

## Context

### Precedent: `src/lib/voice/transcribe.ts`

The transcribe-calling module to mirror is `src/lib/voice/transcribe.ts:1-48`. Key patterns:

- **Configured-check as a plain exported constant** (`transcribe.ts:7-9`):
  `export const SERVER_STT_CONFIGURED = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);`
  computed at module scope, checked by the caller before/around invocation.
- **Dedicated unavailable-error class** (`transcribe.ts:11`): `export class TranscriptionUnavailableError extends Error {}`,
  thrown (not a silently-swallowed return) in three places: when unconfigured (`transcribe.ts:14-18`), when
  `fetch` itself throws e.g. network failure (`transcribe.ts:24-36`, generic message "Could not reach the
  transcription service."), and when the response is non-OK (`transcribe.ts:38-42`, generic message
  `Transcription service returned an error (${res.status}).` — status code only, no response body echoed).
- **Request construction**: raw `fetch` (not `supabase.functions.invoke`) to
  `` `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe` `` with
  `Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}` and a `FormData` body (`transcribe.ts:19-31`).
  `estimateVolume.ts` should follow the same raw-fetch-to-`/functions/v1/<name>` shape rather than the
  supabase-js `functions.invoke` helper, for consistency with this precedent.
- **Response typing**: response body cast to a narrow inline type at the call site
  (`transcribe.ts:43`: `const data = (await res.json()) as { transcript?: string };`) — no shared response
  type file exists for transcribe. For #0011, type the response against #0010's closed schema
  (`{ estimatedMl: number, visibleFillFraction?: number, containerGuess?: string }`) instead of a free-text
  field, since #0010 forbids any free-text/diagnostic field in the Edge Function response.

### Consumer precedent: `src/hooks/useVoiceCapture.ts`

`useVoiceCapture.ts:182-193` shows how a caller consumes the configured-flag + throwing-module pattern:
it checks `SERVER_STT_CONFIGURED` before attempting the server call, wraps the call in try/catch, and on
any failure (including `TranscriptionUnavailableError`) falls through to a fallback path rather than
surfacing the thrown error to the UI directly. `estimateVolume.ts`'s equivalent should not require its
caller to catch a thrown error for the "unavailable" case at all — per #0011's acceptance criteria it must
return a **typed "unavailable" result** rather than throw, which is a deliberate deviation from
`transcribe.ts`'s throw-based unavailability signal (better suited here since there is no browser-side
fallback estimator to fall through to, unlike voice's browser-STT fallback). Genuine network/Edge Function
errors should still surface as a generic, non-diagnostic message string within that same typed result (or
a distinct typed error variant), matching `transcribe.ts`'s generic-message convention
(`transcribe.ts:33-35`, `39-41`) of never echoing raw response bodies/status details to the UI.

### Shared "is backend configured" utility — reuse, don't reinvent

The app already has a shared flag: `isSupabaseConfigured()` in `src/lib/supabase/client.ts:16-20`
(`export function isSupabaseConfigured(): boolean { return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY); }`),
re-exported from `src/lib/supabase/index.ts:3`. Notably, `transcribe.ts` does **not** reuse this — it
redefines an equivalent check locally as `SERVER_STT_CONFIGURED` (`transcribe.ts:7-9`), duplicating the
same `Boolean(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY)` logic. `estimateVolume.ts` should reuse
`isSupabaseConfigured()` from `src/lib/supabase/client.ts` (or its `src/lib/supabase/index.ts` re-export)
rather than repeating this duplication a third time.

### Related

`supabase/functions/estimate-volume/` does not exist yet (only `supabase/functions/transcribe/` exists) —
#0010 (`.claude/issues/0010-edge-function-estimate-volume.md`) defines that Edge Function and its closed
response schema `{ estimatedMl: number, visibleFillFraction?: number, containerGuess?: string }`, which
#0011's response type must match exactly.

## Touch manifest

- `src/lib/photo/estimateVolume.ts` (new file) — the only file touched by this issue's solution.
  No other file is created, edited, or renamed. Consumers (e.g. a future Add-photo flow) are out
  of scope for #0011 and are not wired up here.

## Resolution

Implemented `src/lib/photo/estimateVolume.ts` as the sole change:

- `export async function estimateVolume(image: Blob): Promise<EstimateVolumeResult>` — POSTs to
  `` `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-volume` `` via raw `fetch` with an
  `Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}` header and a `FormData` body (field `image`),
  mirroring `transcribe.ts`'s request construction exactly.
- `EstimateVolumeResult = EstimateVolumeSuccess | EstimateVolumeUnavailable | EstimateVolumeError`,
  a discriminated union on `status`:
  - `EstimateVolumeSuccess`: `{ status: "ok", estimatedMl: number, visibleFillFraction?: number, containerGuess?: string }`
    — matches #0010's closed schema exactly, no free-text field read or surfaced.
  - `EstimateVolumeUnavailable`: `{ status: "unavailable", message: string }` — returned (not thrown)
    when `isSupabaseConfigured()` (reused from `src/lib/supabase/client.ts`, not re-derived locally)
    is false.
  - `EstimateVolumeError`: `{ status: "error", message: string }` — returned for `fetch` throwing,
    non-OK response, unparsable JSON body, or a body missing/mis-typing `estimatedMl`. Messages are
    generic and never echo raw response bodies or diagnostic detail (status code only, matching
    `transcribe.ts`'s convention).
- The function never throws for any of these expected-failure paths — it always resolves to a typed
  result, per the acceptance criteria's deliberate deviation from `transcribe.ts`'s throw-based
  unavailability signal (no browser-side fallback estimator exists to fall through to here).

Verification: `npx tsc -b` passes with no errors after the change (see build log summary below).
Only `src/lib/photo/estimateVolume.ts` was created; no other file was modified, per the touch
manifest.
