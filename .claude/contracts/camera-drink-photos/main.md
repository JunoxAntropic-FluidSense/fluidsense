# Contract: Integrate camera to take photos of drinks

- Task ID: camera-drink-photos
- Created: 2026-07-25
- Status: resolved
- Approval gate 1 (plan): approved — 2026-07-25
- Approval gate 2 (scope + context): approved — 2026-07-25

## Request

Integrate camera to take photo of drinks.

Scope agreed with user:

- Purpose: BOTH (a) attach a photo as a visual record on a FluidEvent (evidence only, does not
  upgrade measurement status), AND (b) AI-based volume estimation from the photo that pre-fills an
  amount.
- Entry points: both the manual Add-entry flow and the Voice confirm-before-save flow.
- Storage: Supabase Storage (new bucket + RLS), not local-only.
- Must respect CLAUDE.md hard rules, especially:
  1. Never blur measured vs guessed — an AI-estimated volume from a photo must be classified as
     `approximate` (per src/types.ts MeasurementStatus), never `measured` or `container_estimated`
     unless genuinely tied to a known container fill level the user confirms.
  2. No diagnostic/clinical-decision language anywhere (UI copy, reasoning strings, comments).
  3. No real patient-identifiable info in code/tests/fixtures/demo data/commit messages.
  4. Voice entries never save without explicit user confirmation — a photo-derived estimate must
     land on the same confirm screen and never auto-persist.
- Relevant existing code: src/types.ts (FluidEvent, MeasurementStatus), src/lib/calc.ts and
  src/lib/reliability.ts (shared calculation engine), src/store/useStore.ts (only module allowed to
  touch persistence/demo-mode isolation), src/pages/Add*, src/pages/Voice*,
  supabase/migrations/0001_init.sql, supabase/functions/ (e.g. existing transcribe function as
  precedent for a server-side call).
- Testing requirement: calc.ts, reliability.ts, period.ts, and src/lib/voice/** are spec-critical —
  any change there needs corresponding test updates in the same change.

## Plan

**Design decisions**

1. Status integrity by construction, not validation code: the photo/AI layer never writes `status`
   itself. It only pre-fills a numeric amount into the existing "approximate amount" step (which
   already sets `status: "approximate"` only on explicit user tap), or suggests a matching known
   container that routes through the existing container+fraction picker (which already sets
   `status: "container_estimated"` only on explicit tap). No new status-transition code anywhere.
2. Attach (visual record) and estimate (AI volume) are independent capabilities on the same photo,
   not one feature — can be used together or separately.
3. Capture via `<input type="file" accept="image/*" capture="environment">`, not `getUserMedia` —
   native camera UX for free, no separate permission state machine, still allows picking an existing
   photo. `getUserMedia` live viewfinder noted as a possible future upgrade, not built now.
4. Compression via `<canvas>` (downscale to ~1280px max dimension, re-encode JPEG) before upload/AI
   call — no new dependency.
5. New Edge Function `estimate-volume`, modeled on `supabase/functions/transcribe/index.ts` — vision
   provider key stays server-side, image read into memory and discarded. Response is a **closed
   schema** `{ estimatedMl, visibleFillFraction?, containerGuess? }` with **no free-text
   reasoning/description field** returned to the client — the concrete enforcement mechanism for hard
   rule 2 (no diagnostic/clinical language can leak through a channel that doesn't exist).
6. Upload timing: `addEvent()` returns the created event as today; photo capture/compression/preview/
   estimate happen pre-save in-memory, and the Storage upload + `updateEvent(id, { photoStoragePath })`
   fire only after save. No change to `addEvent`'s signature.
7. Graceful no-backend behavior: camera capture is offered even without Supabase configured (session-
   only preview, nothing persisted on reload) since Zustand's `persist` middleware re-serializes the
   _entire_ store to localStorage on every mutation — growing that with photos would slow down every
   unrelated write. AI-estimate is hard-unavailable (not soft-degraded) with no backend, since there's
   no client-side vision fallback. A durable local (IndexedDB) fallback is a flagged fast-follow, not
   built now.
8. Deletion: single-event delete is already soft (`deleted: true`, `restoreEvent` exists) so no
   Storage cleanup needed there. `deleteAllFluidData`/`resetAccount` would orphan Storage objects —
   flagged as an explicit out-of-scope follow-up rather than silently handled.
9. Scope is intake/drinks only — `OutputFlowPage.tsx` explicitly excluded.
10. `calc.ts` and `reliability.ts` are deliberately **not modified** — both already bucket
    `approximate`/`container_estimated` together as "estimated," so a photo-derived entry is already
    computationally indistinguishable from any other entry of the same status. A regression test
    locking this in is issue #12.

**New files**: `src/lib/photo/compress.ts` (+test), `src/lib/photo/storage.ts`,
`src/lib/photo/estimateVolume.ts`, `src/hooks/usePhotoCapture.ts`,
`src/components/photo/PhotoCaptureField.tsx`, `supabase/functions/estimate-volume/index.ts`,
`supabase/migrations/0002_drink_photos.sql`.

**Changed files**: `src/types.ts` (`FluidEvent.photoStoragePath?`, `photoSource?`),
`src/lib/voice/types.ts` (additive optional fields), `src/pages/IntakeFlowPage.tsx`,
`src/pages/VoicePage.tsx`, `src/components/EventRow.tsx`, `src/components/EditEventModal.tsx`,
`src/pages/PrivacyPage.tsx`.

**Pre-existing gap flagged, not solved by this feature**: no Supabase client wrapper or auth wired up
yet in `src/` (`@supabase/supabase-js` is a dependency but unused) — RLS policies keyed on `auth.uid()`
are inert until separate, already-tracked auth work lands. This feature's migration/policies are
written in the same forward-looking style as `0001_init.sql` regardless.

## Linked issues

- #0007 Add photo fields to data model + Storage migration — resolved
- #0008 Image compression utility — resolved
- #0009 Supabase Storage client helper — resolved
- #0010 Edge Function `estimate-volume` — resolved
- #0011 Client estimate module — resolved
- #0012 `usePhotoCapture` hook — resolved
- #0013 Shared `PhotoCaptureField` UI component — resolved
- #0014 Wire into manual Add-entry flow — resolved
- #0015 Wire into Voice confirm screen — resolved
- #0016 Render attached photos in History/edit views — resolved
- #0017 Privacy copy update — resolved
- #0018 Regression tests: calc/reliability treat photo-derived entries identically — resolved

## Context summary

**Correction to the plan**: a Supabase client wrapper already exists —
`src/lib/supabase/client.ts` (exports `supabase: SupabaseClient | null` and
`isSupabaseConfigured()`), plus `auth.ts`, `session.ts`, and a barrel `index.ts`. The Planning
agent's assumption ("no Supabase client wrapper yet") was wrong. #0009 must reuse this, not create
a new one. #0011 and #0012 should likewise reuse `isSupabaseConfigured()` rather than duplicating a
local constant the way `voice/transcribe.ts`'s `SERVER_STT_CONFIGURED` does today (a pre-existing
small duplication, not one to repeat a third time).

**Concrete conventions locked in during context-gathering**:

- Storage bucket name: `drink-photos` (private, RLS via `profiles.owner_user_id`). Object path:
  `<profileId>/<eventId>.jpg`. Defined in #0007's migration, consumed by #0009/#0014/#0016.
- `estimate-volume` Edge Function returns exactly `{ estimatedMl: number, visibleFillFraction?:
number, containerGuess?: string }` — no free-text field, ever (the concrete enforcement of hard
  rule 2). Modeled structurally on `supabase/functions/transcribe/index.ts`.
- Vitest runs in default `node` environment (no jsdom/canvas anywhere in this repo) — #0008's test
  can only cover a pure, extracted dimension-calculation function, not actual canvas rendering.
- `extractEvents.test.ts` uses only `.toBe()` field assertions (no `toEqual`/`toStrictEqual`) —
  confirmed additive `StructuredVoiceEvent` photo fields are safe for #0015 without breaking it.
- `StatusBadge` (src/components/ui/Badge.tsx) is the app's only status-to-color/icon mapping
  (green=measured, amber=container_estimated/approximate, gray=unmeasured). #0016's new photo
  thumbnail must use a visually distinct treatment and never reuse those colors/glyphs — the
  concrete enforcement of hard rule 1 at the UI layer.

**Real dependency chain found (tighter than the plan's file-overlap-only view)**: #0007 adds
`FluidEvent.photoStoragePath`/`photoSource`, which #0009, #0014, #0016, and #0018 all reference —
those need #0007's type change to actually exist first, not just to avoid file overlap. #0012
wraps #0008/#0009/#0011. #0013 consumes #0012's hook shape. #0014 and #0015 both embed #0013.
#0016 also wants #0009's exact signed-URL export name settled.

Proposed Stage 3 execution order (waves; within a wave, issues run in parallel — disjoint files
confirmed for every pair):

1. **#0007** alone (foundational type + migration change).
2. **#0008, #0009, #0010, #0011, #0017, #0018** in parallel (each only needs #0007's types to
   exist; touch disjoint files).
3. **#0012, #0016** in parallel (need wave 2's modules/exports settled).
4. **#0013** alone (needs #0012's finished hook shape).
5. **#0014, #0015** in parallel (both embed #0013; touch disjoint page files).

## Final summary

All 12 issues resolved across 5 sequential waves. Final combined `npm run build` and `npm run test`
(6 files, 49 tests) both pass clean.

- **#0007** — `FluidEvent.photoStoragePath?`/`photoSource?` added to `src/types.ts`; new
  `supabase/migrations/0002_drink_photos.sql` creates the private `drink-photos` Storage bucket +
  RLS policies and mirrors nullable columns on `fluid_events`.
- **#0008** — `src/lib/photo/compress.ts` (+test): canvas-based downscale to ~1280px/JPEG
  re-encode, no new dependency; pure `computeTargetDimensions` unit-tested (Node test env has no
  canvas).
- **#0009** — `src/lib/photo/storage.ts`: upload + signed-URL helpers for the `drink-photos`
  bucket, reusing the pre-existing `src/lib/supabase/client.ts` wrapper, typed results (never
  throws).
- **#0010** — `supabase/functions/estimate-volume/index.ts`: new Edge Function mirroring
  `transcribe/index.ts`; vision call returns a closed schema `{estimatedMl, visibleFillFraction?,
containerGuess?}` with the provider's raw response never passed through — no free-text channel
  exists for diagnostic language to leak through.
- **#0011** — `src/lib/photo/estimateVolume.ts`: client caller, typed `ok`/`unavailable`/`error`
  result, reuses `isSupabaseConfigured()`.
- **#0012** — `src/hooks/usePhotoCapture.ts`: capture/compress/upload/estimate orchestration
  mirroring `useVoiceCapture`'s status-machine/ref/cleanup shape; never auto-persists.
- **#0013** — `src/components/photo/PhotoCaptureField.tsx`: presentational capture/preview/estimate
  widget; suggested amounts surface via `onAcceptEstimate` for the parent to apply through its own
  existing status-setting code — never sets status itself.
- **#0014** — `src/pages/IntakeFlowPage.tsx` wired in; upload fires after `addEvent()` returns,
  `updateEvent(id, {photoStoragePath})` follows; upload failure never blocks the save.
- **#0015** — `src/lib/voice/types.ts` + `src/pages/VoicePage.tsx` wired in; photo/estimate flow
  through the same `onChange`/`updateCandidate` channel as every other field, persists only inside
  `confirmAll` (the sole explicit-confirm save point, per hard rule 4).
- **#0016** — `src/components/PhotoThumbnail.tsx` (new) + `EventRow.tsx`/`EditEventModal.tsx`:
  thumbnail uses a neutral treatment, deliberately not reusing `StatusBadge`'s measured/estimated
  colors or icons.
- **#0017** — `src/pages/PrivacyPage.tsx`: new "Photo data" disclosure section, matching existing
  tone/structure.
- **#0018** — `src/lib/calc.test.ts` (+case) and new `src/lib/reliability.test.ts` lock in that
  `calc.ts`/`reliability.ts` treat photo-derived entries identically to any other entry of the same
  status — no production code changed.

**Correction found during context-gathering, not in the original plan**: a Supabase client wrapper
already existed (`src/lib/supabase/client.ts`); #0009/#0011/#0012 reused it instead of building a
new one.

**Not committed** — per workflow rules this stays on the working tree for review. Note the repo also
has unrelated pre-existing uncommitted work (an auth integration and a weather feature) not part of
this contract; keep those separate when staging/committing.
