# Issue #0012: `usePhotoCapture` hook

- Parent contract: camera-drink-photos
- Status: open
- Created: 2026-07-25

## Problem

No shared orchestration exists for capture → compress → (upload | estimate) as a single stateful flow
reusable across the Add and Voice pages.

## Acceptance criteria

- [ ] `src/hooks/usePhotoCapture.ts` mirrors `useVoiceCapture`'s status-machine shape/conventions
      (idle/capturing/processing/ready/error or similar) for consistency.
- [ ] Wraps #0008 (compress), #0009 (storage upload), #0011 (estimate) behind a single hook API.
- [ ] Exposes: a local preview of the captured image (object URL), a way to request an AI estimate
      (only offered when backend is configured), and a way to attach the captured photo without
      requesting an estimate.
- [ ] Never auto-persists anything — returns data to the caller; the caller decides when to attach to
      a `FluidEvent`, consistent with "voice entries never save without explicit confirmation" applied
      the same way to photos.

## Context

`useVoiceCapture` (src/hooks/useVoiceCapture.ts) is the explicit precedent to mirror:

- **Status machine**: union type `"idle" | "requesting_permission" | "listening" |
"transcribing" | "error" | "done"` (lines 9-15). Transitions: `start()` (line 97) sets
  `requesting_permission`, then on success `listening` (line 164); `stop()` (line 88-95) or a
  timer cap moves to `transcribing`; the async completion handler (`handleStopped`, line 177)
  lands on `done` or `error`. `start()` failure jumps straight to `error` (line 114). `cancel()`
  (line 209) and `reset()` (line 78) both force back to `idle`, clearing all state/refs. Adapt
  states for photo flow per the acceptance criteria's suggested
  idle/capturing/processing/ready/error.
- **Refs vs state**: mutable resources (MediaRecorder, MediaStream, timers, cancellation flags)
  live in `useRef`, not `useState`; a `statusRef` mirror (lines 52-55) is kept in sync via
  `useEffect` so async callbacks always read the latest status instead of a stale closure.
  `usePhotoCapture` should use the same ref-for-resources / state-for-UI split, with an
  equivalent `cancelledRef` guard around any async compress/upload/estimate calls so a
  cancel/reset mid-flight doesn't let a stale response clobber state.
- **Cleanup**: a single unmount `useEffect` (lines 69-76) releases all held resources
  (`releaseStream()` stops MediaStream tracks, timer cleared, recognition stopped).
  `useVoiceCapture` never creates an object URL — but `usePhotoCapture` DOES need one for the
  local image preview named in the acceptance criteria (`URL.createObjectURL` on the captured
  Blob). Follow the same unmount-cleanup discipline: revoke any created object URL both in the
  unmount effect and whenever a fresh capture/reset replaces the previous one, to avoid leaking
  blob URLs across repeated capture cycles.
- **Backend-availability gating**: mirror `SERVER_STT_CONFIGURED`
  (src/lib/voice/transcribe.ts:7-9) — `Boolean(import.meta.env.VITE_SUPABASE_URL &&
import.meta.env.VITE_SUPABASE_ANON_KEY)` computed once and used to conditionally expose the
  "request AI estimate" action, exactly as the acceptance criteria requires ("only offered when
  backend is configured"). Prefer this same boolean-const pattern over branching inside the hook —
  or better, reuse the shared `isSupabaseConfigured()` from `src/lib/supabase/client.ts` (see
  issue #0011's Context, which found `transcribe.ts` duplicates this check locally rather than
  reusing the shared utility — don't repeat that duplication a third time here).
- **Return shape convention**: this codebase always returns a flat plain object from hooks, never
  a tuple (see `useFluidData.ts`, `useOnlineStatus.ts`, `useAuthBootstrap.ts`). Follow
  `useVoiceCapture`'s return (lines 218-232) shape: status, derived data fields, action callbacks
  (`useCallback`-wrapped), and a capability flag (`supported`, computed inline from
  `navigator`/env). For `usePhotoCapture`, this implies returning `status`, an error-message
  field, the preview object URL, an `estimateAvailable`-style flag, and actions to capture,
  request an estimate, attach without estimating, and reset/cancel — never auto-persisting per
  the acceptance criteria.
- **Dependency modules**: wraps #0008 (`src/lib/photo/compress.ts`), #0009
  (`src/lib/photo/storage.ts`), and #0011 (`src/lib/photo/estimateVolume.ts`) — code against the
  function signatures/typed-result shapes described in those issues' Context/acceptance criteria
  (storage and estimate both return typed catchable results / "unavailable" results rather than
  throwing).

General hook conventions confirmed across src/hooks/ (useFluidData.ts, useOnlineStatus.ts,
useAuthBootstrap.ts): plain-object returns, `useEffect` cleanup returning an unsubscribe/release
function, comments cross-referencing sibling hooks' shape (useAuthBootstrap.ts explicitly says it
follows useOnlineStatus.ts's pattern) — usePhotoCapture should likewise comment that it follows
useVoiceCapture's shape.

## Touch manifest

- `src/hooks/usePhotoCapture.ts` (new file) — the only file touched, per scope.
  - Reads (no edits): `src/hooks/useVoiceCapture.ts` (precedent), `src/lib/photo/compress.ts`,
    `src/lib/photo/storage.ts`, `src/lib/photo/estimateVolume.ts`, `src/lib/supabase/client.ts`,
    `src/hooks/useOnlineStatus.ts`, `src/hooks/useAuthBootstrap.ts` (return-shape/cleanup convention
    check).

## Resolution

Implemented `usePhotoCapture` mirroring `useVoiceCapture`'s shape:

- **Status machine**: `"idle" | "capturing" | "processing" | "ready" | "error"`. `capture(file)`
  moves `idle -> capturing`, validates the image is decodable via `createImageBitmap` (catches
  corrupt files early rather than deferring to compression time), then `-> ready` (or `-> error`
  on a bad file). `requestEstimate()` and `attach(profileId, eventId)` both move `ready ->
processing -> ready`, regardless of whether the async call itself succeeded — a failed estimate
  or failed upload is surfaced via the _typed result_ they resolve to, not by parking the whole
  hook in "error", so a failed estimate never blocks a subsequent attach.
- **Refs vs state**: `blobRef` (captured Blob/File), `previewUrlRef` (mirrors the object URL for
  cleanup), `cancelledRef` (set by `cancel()`, checked after every await), and a `statusRef`
  mirror kept in sync via `useEffect`, checked post-await (`statusRef.current !== "processing"`)
  so a reset/new capture mid-flight can't let a stale estimate/upload response clobber state.
- **Object-URL preview**: created in `capture()` via `URL.createObjectURL`, revoked via a shared
  `revokePreview()` helper both in the unmount cleanup effect and at the start of every
  `capture()`/`reset()`, so repeated capture cycles never leak blob URLs.
- **Backend gating**: `estimateAvailable` is `ESTIMATE_AVAILABLE`, a module-scope constant from
  `isSupabaseConfigured()` (src/lib/supabase/client.ts) — computed once, boolean-const pattern,
  matching `SERVER_STT_CONFIGURED`'s precedent rather than re-deriving the env check locally.
- **Return shape**: flat plain object — `status`, `previewUrl`, `errorMessage`, `estimate`
  (the raw `EstimateVolumeResult` discriminated union from #0011, passed through rather than
  re-flattened, so callers get the same `ok`/`unavailable`/`error` idiom used elsewhere), the
  `estimateAvailable` capability flag, and actions `capture`, `requestEstimate`, `attach`,
  `reset`, `cancel`.
- **Never auto-persists**: `capture()` only builds a local preview; `requestEstimate()` only
  calls `estimateVolume()` and returns the suggestion; `attach(profileId, eventId)` compresses
  and uploads the blob via `uploadDrinkPhoto()` and returns the storage path — it does not write
  to a `FluidEvent` or touch `src/store/useStore.ts`. The caller decides when to call `attach`
  and when to commit the resulting path to an event.

`npm run build` (`tsc -b && vite build`) passed with no type errors.
