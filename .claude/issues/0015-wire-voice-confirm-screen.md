# Issue #0015: Wire into Voice confirm screen

- Parent contract: camera-drink-photos
- Status: open
- Created: 2026-07-25

## Problem

`VoicePage`'s confirm-before-save screen has no photo affordance.

## Acceptance criteria

- [x] `PhotoCaptureField` (#0013) is available on the confirm screen for intake (drink) events.
- [x] Photo capture / AI estimate never causes auto-save — the user must still tap the existing
      explicit confirm action (hard rule 4).
- [x] `StructuredVoiceEvent` (`src/lib/voice/types.ts`) gains additive optional in-memory photo fields
      — not persisted into `FluidEvent` until save.
- [x] No change to existing voice classification/extraction behavior covered by
      `extractEvents.test.ts`; if any shared type changes could affect it, run the suite and update as
      needed.

## Context

- Confirm screen component: `src/pages/VoicePage.tsx`. The `review` phase (rendered at
  `src/pages/VoicePage.tsx:305-359`) is the confirm-before-save screen. It maps `candidates` to
  `EventCandidateCard` (`src/pages/VoicePage.tsx:370-554`), which is where per-candidate UI
  (amount, category, container, duplicate-resolution, edit) lives — this is the natural place to
  mount `PhotoCaptureField` per candidate, gated on `candidate.direction === "intake"` (see
  `Direction` handling below).
- Pending structured event state: `candidates` (`useState<StructuredVoiceEvent[]>`, declared at
  `src/pages/VoicePage.tsx:39`), mutated via `updateCandidate` (`src/pages/VoicePage.tsx:86-93`,
  calls `setCandidates` with a shallow merge of `Partial<StructuredVoiceEvent>` per index) and
  `removeCandidate`/`removed` (`src/pages/VoicePage.tsx:40, 95-96`). `EventCandidateCard` receives
  `onChange={(changes) => updateCandidate(i, changes)}` (`src/pages/VoicePage.tsx:323`), so a
  photo field can be threaded through the exact same `onChange` callback used by
  `EditCandidate` (`src/pages/VoicePage.tsx:606-611` etc.) — no new state channel needed.
- Explicit save handler (the ONLY thing that must persist a voice-derived event, per hard rule 4):
  `confirmAll` at `src/pages/VoicePage.tsx:110-143`, wired to the "Confirm and save" button's
  `onClick` at `src/pages/VoicePage.tsx:347-357` (`disabled={!canConfirm}`). It iterates
  `activeCandidates` and calls `addEvent({...})` (`src/pages/VoicePage.tsx:123-139`) — this is the
  single call site that maps a `StructuredVoiceEvent` into a persisted event (via
  `useStore((s) => s.addEvent)`, `src/pages/VoicePage.tsx:31`). Any new photo fields on the
  candidate must NOT be read/persisted anywhere except inside this function, and only once the
  user taps this button — no other effect/handler in the file writes to the store.
- `StructuredVoiceEvent` (`src/lib/voice/types.ts:12-32`) current shape:
  `intent`, `direction: Direction | "unknown"`, `category?`, `subtype?`, `amountValue?`,
  `amountUnit?`, `amountMl?`, `measurementStatus`, `quantityOfEvents?`, `containerName?`,
  `containerCandidates?`, `containerFraction?`, `eventTime`, `confidence`, `ambiguities: string[]`,
  `warnings: string[]`, `duplicateOf?: FluidEvent`, `originalTranscript`, `clauseText`. All new
  photo fields should be added as additive optional properties at the end of this interface (e.g.
  alongside `containerName`/`containerFraction`), matching the pattern of other optional
  UI-affordance fields like `containerCandidates`. `FluidEvent` (`src/types.ts`) currently has no
  photo-related fields at all (issue #0007, photo data model/storage migration, is still open per
  `.claude/issues/0007-photo-data-model-storage-migration.md`), which confirms these new
  `StructuredVoiceEvent` photo fields are purely in-memory/UI state until a later issue wires
  persistence — `confirmAll` must not attempt to write them into the `addEvent(...)` payload yet.
- Direction/classification is already distinguishable: `StructuredVoiceEvent.direction` is
  `Direction | "unknown"` (`src/lib/voice/types.ts:14`), and `VoicePage` already branches on it
  (e.g. ambiguous-direction picker at `src/pages/VoicePage.tsx:401-424`, category select filtering
  by `candidate.direction === "output" ? OUTPUT_CATEGORIES : INTAKE_CATEGORIES` at
  `src/pages/VoicePage.tsx:565-566`). The photo affordance (per acceptance criteria, intake/drink
  events only) can be conditionally rendered with `candidate.direction === "intake"` inside
  `EventCandidateCard`, consistent with existing conditional-rendering patterns in that component
  (e.g. `candidate.containerCandidates && ...` at `src/pages/VoicePage.tsx:464-487`).
- `PhotoCaptureField` (issue #0013, `src/components/photo/PhotoCaptureField.tsx`) does not exist
  yet — it is still an open issue (`.claude/issues/0013-photo-capture-field-component.md`). This
  issue's implementation should import it once available; if #0013 isn't yet resolved, note the
  dependency in the touch manifest.
- `src/lib/voice/extractEvents.test.ts` (187 lines): skimmed in full. All assertions use
  field-level matchers (`expect(e.<field>).toBe(...)`) via a `firstEvent(transcript)` helper
  (`src/lib/voice/extractEvents.test.ts:22-29`) that returns `result.events[0]`. There are NO
  `toEqual`, `toMatchObject`, or `toStrictEqual` calls anywhere in the file (confirmed via grep),
  so there is no exhaustive full-object-shape assertion that adding new optional fields to
  `StructuredVoiceEvent` could break. Adding additive optional photo fields to the interface is
  safe for this suite as-is; no test updates should be needed, but the suite should still be run
  after the type change per the acceptance criteria.

## Touch manifest

- `src/lib/voice/types.ts` — add additive optional in-memory fields to `StructuredVoiceEvent`:
  `pendingPhotoPreviewUrl?: string` and
  `pendingPhotoAttach?: (profileId: string, eventId: string) => Promise<UploadPhotoResult>`
  (imports `UploadPhotoResult` from `../photo/storage`), placed alongside the other optional
  UI-affordance fields (after `containerFraction`). Never read by `extractEvents.ts` and never
  mapped into `addEvent(...)`'s payload — purely transient UI state until `confirmAll` runs.
- `src/pages/VoicePage.tsx`:
  - Import `PhotoCaptureField` from `../components/photo/PhotoCaptureField`.
  - `EventCandidateCard`: mount `<PhotoCaptureField />` gated on
    `candidate.direction === "intake"`, placed after the existing amount/category/edit block and
    before the container-candidates/ambiguities/warnings/duplicate sections (consistent with the
    "affordance lives in the per-candidate card" precedent). Wire:
    - `onAcceptEstimate={(amountMl) => onChange({ amountMl, measurementStatus: "approximate" })}`
      — routes through the existing `onChange` prop (→ `updateCandidate`), same channel as every
      other field edit. Does not call `addEvent`/`updateEvent` itself.
    - `onAttach={(photo) => onChange({ pendingPhotoPreviewUrl: photo?.previewUrl, pendingPhotoAttach: photo?.attach })}`
      — stores the pending attach handle on local candidate state only.
  - `confirmAll`: after `addEvent(...)` returns the created event for a candidate with
    `c.pendingPhotoAttach` set, call `c.pendingPhotoAttach(patient.id, created.id)`; on success
    (`result.path` non-null, no `result.error`) call
    `updateEvent(created.id, { photoStoragePath: result.path }, currentUser.displayName, "Photo attached via voice entry")`.
    Wrapped so an upload failure (`result.error` or a thrown rejection) never blocks the event
    from having already been saved — this is the only place any photo field is read, and only
    after the user has tapped "Confirm and save".
  - Add `updateEvent` to the `useStore` selectors alongside the existing `addEvent`/`deleteEvent`.
- No changes to `extractEvents.ts` or any other voice/lib file — classification/extraction
  behavior is unaffected; suite re-run to confirm per acceptance criteria.

## Resolution

Implemented exactly per the touch manifest, no deviations:

- `src/lib/voice/types.ts`: added `pendingPhotoPreviewUrl?: string` and
  `pendingPhotoAttach?: (profileId: string, eventId: string) => Promise<UploadPhotoResult>` to
  `StructuredVoiceEvent`, importing `UploadPhotoResult` from `../photo/storage`. Both are additive
  optional and untouched by `extractEvents.ts`.
- `src/pages/VoicePage.tsx`:
  - Added `updateEvent` to the `useStore` selectors.
  - `EventCandidateCard` now mounts `<PhotoCaptureField />` when
    `!isAmbiguousDirection && candidate.direction === "intake"`, placed after the amount/edit
    block and before the container-candidates section. `onAcceptEstimate` and `onAttach` both
    route through the existing `onChange` prop only — no new state channel, no direct store
    writes.
  - `confirmAll` now captures `addEvent(...)`'s return value (`created`) and, only when
    `c.pendingPhotoAttach` is set, calls it with `(patient.id, created.id)` after the event has
    already been persisted; on success it calls `updateEvent(created.id, { photoStoragePath:
result.path }, currentUser.displayName, "Photo attached via voice entry")`. Failures
    (`result.error` or a rejected promise) are swallowed and never block or roll back the save —
    the event is already saved by the time the attach is attempted.

Verification:

- `npm run build` — passes (tsc -b + vite build, no type errors).
- `npx vitest run src/lib/voice/extractEvents.test.ts` — 18/18 passed, unchanged.
- `npm run test` (full suite) — 49/49 passed across 6 files.

No files outside `src/pages/VoicePage.tsx` and `src/lib/voice/types.ts` were touched.
`IntakeFlowPage.tsx` (issue #0014) was not modified.
