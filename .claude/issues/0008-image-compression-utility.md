# Issue #0008: Image compression utility

- Parent contract: camera-drink-photos
- Status: open
- Created: 2026-07-25

## Problem

Mobile photos are several MB and must be downscaled/re-encoded before upload or AI submission; no
such utility exists.

## Acceptance criteria

- [ ] `src/lib/photo/compress.ts` exports a function taking an image `File`/`Blob` and returning a
      downscaled (~1280px max dimension) re-encoded JPEG `Blob`, via `<canvas>`, no new dependency.
- [ ] Preserves aspect ratio (no distortion) for both portrait and landscape input.
- [ ] `src/lib/photo/compress.test.ts` covers the target-dimension calculation (extract that as a
      pure, testable function even if actual canvas rendering isn't exercised in vitest/jsdom).
- [ ] No diagnostic/clinical language in comments or error messages.

## Context

- Convention: `src/lib/` modules are flat, single-purpose TS files with named exports (no default
  exports), no classes except small `Error` subclasses (e.g. `TranscriptionUnavailableError` in
  `voice/transcribe.ts`). Pure helpers live at module top-level; comments explain _why_, not what.
  Subdirectories (`voice/`, `supabase/`) hold a cohesive feature's files flat inside (no further
  nesting); `supabase/` has a barrel `index.ts` re-exporting its public surface, `voice/` does not
  (consumers import each file directly). Follow the no-barrel pattern for `photo/` unless a Solution
  agent later needs multiple public entry points beyond `compress.ts`.
- Test convention (`calc.test.ts`, `period.test.ts`, `voice/extractEvents.test.ts`): `import {
describe, it, expect } from "vitest"`, file colocated as `<name>.test.ts` next to the module,
  descriptive `it("...")` strings phrased as behavior/assertions, small local fixture builder
  functions (e.g. `ev(partial)`) rather than fixture files. No test setup/teardown files exist in
  the repo.
- Test environment: `vite.config.ts` has no `test` block at all (no `vitest.config.*` file either),
  so Vitest runs its default `environment: "node"` — no DOM, no `HTMLCanvasElement`/`document`, and
  no `jsdom`/`happy-dom`/canvas packages are in `package.json` devDependencies. This confirms actual
  `<canvas>` rendering (`canvas.getContext("2d")`, `toBlob`) cannot be exercised in tests here.
  `compress.test.ts` must therefore import and test only a pure, exported dimension-calculation
  function (e.g. `computeTargetDimensions(width, height, maxDim) -> {width, height}`) extracted out
  of the canvas-using code path, per the acceptance criteria — do not attempt to mock/stub canvas.
- No image-compression library exists in `package.json` dependencies (checked both `dependencies`
  and `devDependencies`) — confirms the "no new dependency" constraint is achievable purely with the
  native `<canvas>` API (`createImageBitmap`/`Image` + `canvas.toBlob(..., "image/jpeg", quality)`).
- Precedent for browser-API-calling lib code that deals with `Blob`/`File` inputs:
  `src/lib/voice/transcribe.ts` (`transcribeAudioServer(blob: Blob)`) — async function taking a
  Blob, throwing a dedicated `Error` subclass on failure, with an explanatory header comment. Use a
  similar shape/error-handling style for `compress.ts`'s async compression function.
- Directory to create: `src/lib/photo/` (does not yet exist; no existing photo/image/compress files
  found anywhere in `src/`).

## Touch manifest

- `src/lib/photo/compress.ts` (new) — `computeTargetDimensions(width, height, maxDim)` pure function,
  `PhotoCompressionError` class, `compressImage(file: File | Blob, maxDim?: number, quality?: number):
Promise<Blob>` using `createImageBitmap` + `<canvas>` + `toBlob("image/jpeg", quality)`.
- `src/lib/photo/compress.test.ts` (new) — vitest coverage of `computeTargetDimensions` only (no
  canvas/DOM available in this repo's default Node test environment).

No other files touched (scope is strictly these two new files under `src/lib/photo/`).

## Resolution

Added `src/lib/photo/compress.ts` with:

- `computeTargetDimensions(width, height, maxDim = 1280)` — pure function returning `{width, height}`
  scaled to fit within `maxDim` on the longer edge, preserving aspect ratio; no-op if already within
  bounds; throws `PhotoCompressionError` on non-positive input.
- `PhotoCompressionError extends Error` — dedicated error class, mirroring
  `TranscriptionUnavailableError` in `voice/transcribe.ts`.
- `compressImage(file: File | Blob, maxDim = 1280, quality = 0.8): Promise<Blob>` — decodes via
  `createImageBitmap`, computes target size with `computeTargetDimensions`, draws into an offscreen
  `<canvas>`, and re-encodes with `canvas.toBlob(..., "image/jpeg", quality)`. Throws
  `PhotoCompressionError` if decoding, canvas context creation, or encoding fails. No new npm
  dependency; no diagnostic/clinical language anywhere in code or errors.

Added `src/lib/photo/compress.test.ts` with 9 tests against `computeTargetDimensions` (the only
piece exercisable without a DOM/canvas in this repo's default Node Vitest environment): landscape
and portrait no-op cases, exact-boundary no-op, landscape downscale, portrait downscale, square
downscale, default-`maxDim` behavior, extreme-aspect-ratio floor (never zero), and invalid-input
error case.

Test status: `npx vitest run src/lib/photo/compress.test.ts` — 1 file, 9 tests, all passed.
Build status: `npm run build` (`tsc -b && vite build`) — succeeded with no errors (pre-existing
unrelated chunk-size warning only).

No files outside `src/lib/photo/` were touched.
