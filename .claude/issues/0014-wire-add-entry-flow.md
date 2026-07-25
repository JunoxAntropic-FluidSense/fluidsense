# Issue #0014: Wire into manual Add-entry flow

- Parent contract: camera-drink-photos
- Status: open
- Created: 2026-07-25

## Problem

`IntakeFlowPage` has no photo-capture affordance.

## Acceptance criteria

- [x] `PhotoCaptureField` (#0013) is available as an optional step/section in the intake flow, for
      drink (intake) entries only.
- [x] Accepting an AI estimate pre-fills the existing "approximate amount" step's value — the user
      still must tap to confirm, which is what actually sets `status: "approximate"`.
- [x] Attaching a photo without requesting an estimate still allows saving the event through existing
      status paths, unaffected.
- [x] `photoStoragePath` is persisted via the existing `addEvent`/`updateEvent` pattern: upload fires
      only after `addEvent()` returns the created event, then `updateEvent(id, { photoStoragePath })`.

## Context

- **File**: `src/pages/IntakeFlowPage.tsx` (full 4-step flow: 1 category → 2 method → 3 amount-entry
  → 4 confirm/save). Uses local `useState` for `step`, `category`, `method`, `amountMl`, `status`,
  `container`, `fraction`, `note`, `unitInput`, `rawInput`. No existing tests reference
  `IntakeFlowPage` (only `src/App.tsx` imports/routes it).
- **Approx-amount step** (sets `status: "approximate"`): `src/pages/IntakeFlowPage.tsx:259-289`
  (`step === 3 && method === "approx"`) — grid buttons at lines 264-267
  (`setAmountMl(a.ml); setStatus("approximate"); goConfirm();`) and "Other approximate amount"
  button lines 277-288 which routes to a custom `step === 3.5` numeric-entry block (lines 291-312)
  whose Continue button (lines 301-310) calls `setAmountMl(parseFloat(rawInput)); goConfirm();`
  (does not re-set `status` — relies on it already being `"approximate"` from line 280).
- **Container+fraction step** (sets `status: "container_estimated"`):
  `src/pages/IntakeFlowPage.tsx:235-257` — `step === 3 && (method === "saved" || method ===
"standard") && container`, fraction buttons at 239-255, `onClick` at lines 242-247 sets
  `fraction`, `amountMl = round(container.fullVolumeMl * f.value)`,
  `setStatus("container_estimated")`, `goConfirm()`.
- **Best insertion point for optional photo step**: Step 4 (confirm/save, lines 314-356) is the
  natural non-disruptive spot — it already renders a `Card` with amount/status/note before the
  `Confirm and save` button; a `PhotoCaptureField` section can be added inside that Card (after the
  note field, before the Confirm button) without touching step-numbering or navigation logic. No
  output-flow filtering needed — this file only handles intake (`direction: "intake"` hardcoded at
  line 86).
- **`addEvent`**: `src/store/useStore.ts:73-75` —
  `addEvent: (e: Omit<FluidEvent, "id" | "recordedTime"> & { recordedTime?: string }) => FluidEvent`.
  Implementation at lines 424-432: synchronously builds the event with a new `uuid()`, adds to
  store, and **returns the created `FluidEvent`** — confirms the plan's "upload after `addEvent()`
  returns" pattern is supported.
- **`updateEvent`**: `src/store/useStore.ts:76-81` —
  `updateEvent: (id: string, changes: Partial<FluidEvent>, changedBy: string, reason?: string) =>
void`. Implementation at lines 434-453 merges `changes` into the matching event and records edit
  history — supports `updateEvent(id, { photoStoragePath }, ...)`, but `changedBy` is a required
  (non-optional) 3rd param, so pass `currentUser.displayName` (already in scope at line 54).
- **Dependency**: `photoStoragePath` does not exist on `FluidEvent` yet — added by #0007 (must land
  first, or this issue's touch manifest must not assume it type-checks until #0007 merges).
  `PhotoCaptureField` (#0013) also does not exist yet — this issue depends on it.

## Touch manifest

Single file touched: `src/pages/IntakeFlowPage.tsx`.

- **Imports**: add `PhotoCaptureField` and its `PhotoAttachHandle` type from
  `../components/photo/PhotoCaptureField`.
- **New local state**: `const [photoHandle, setPhotoHandle] = useState<PhotoAttachHandle | null>(null);`
  — holds the `{ previewUrl, attach }` object handed back by `onAttach`, or `null`.
- **New store binding**: `const updateEvent = useStore((s) => s.updateEvent);` (alongside the
  existing `addEvent` binding at line 53) — needed for the post-attach `photoStoragePath` write.
- **Step 4 Card** (inside the `<Card className="p-5 space-y-3">` block, lines 316-348): mount
  `<PhotoCaptureField onAcceptEstimate={...} onAttach={setPhotoHandle} />` after the "Optional note"
  `<label>` block and before the Card's closing tag — matches the Context's suggested insertion
  point (inside the Card, after note, before the Confirm button which lives outside the Card).
  - `onAcceptEstimate={(amountMl) => { setAmountMl(amountMl); setStatus("approximate"); }}` — the
    only status-setting call added, reusing the existing `setStatus` setter exactly as the
    container/approx steps already do. No new status-transition logic.
- **`save()`**: converted from a sync `void` function to `async`. Behaviour:
  1. Calls `addEvent({...})` exactly as before (unchanged fields/shape) and captures the returned
     `FluidEvent`.
  2. If `photoHandle` is non-null, calls `await photoHandle.attach(patient.id, createdEvent.id)`
     inside a `try/catch`. `patient.id` is the "profile id" per `buildPhotoStoragePath`'s
     `<profileId>/<eventId>.jpg` convention (`src/lib/photo/storage.ts`) — matches how this file
     already uses `patient.id` as `patientId` on the event itself.
  3. On a successful upload (`result.path` truthy), calls
     `updateEvent(createdEvent.id, { photoStoragePath: result.path }, currentUser.displayName, "Attached photo")`.
  4. On upload failure (`result.error` set) or a thrown error, does nothing further — no
     `photoStoragePath` is set, no rollback of the already-saved event, and no crash. The fluid
     entry is saved either way.
  5. `navigate("/")` still runs unconditionally at the end, same as before.
- **Confirm button**: `onClick={save}` unchanged at the call site — `save` becoming `async` is a
  compatible change for a `void`-typed `onClick` handler.
- Not touched: `photoSource` field (out of this issue's acceptance criteria), step numbering,
  navigation, `reset()`, the approx-amount and container-fraction steps' own status-setting code
  (both cited in Context as already correct and not to be duplicated), `VoicePage.tsx` (issue
  #0015, parallel/out of scope).

## Resolution

Implemented exactly per the touch manifest above, in `src/pages/IntakeFlowPage.tsx` only:

- Imported `PhotoCaptureField` + `PhotoAttachHandle` and added `updateEvent` from the store.
- Added `photoHandle` state, cleared it in `reset()`, and mounted `<PhotoCaptureField
onAcceptEstimate={...} onAttach={setPhotoHandle} />` inside the Step 4 `Card`, after the note
  field and before the `Card` closes (Confirm button remains outside, unaffected).
- `onAcceptEstimate` only calls `setAmountMl` + the existing `setStatus("approximate")` setter —
  no new status-transition code, matching acceptance criterion 2.
- `save()` is now `async`: `addEvent(...)` is unchanged and still returns the created event; if a
  photo was attached, `photoHandle.attach(patient.id, createdEvent.id)` runs in a `try/catch`, and
  only on a successful path does `updateEvent(createdEvent.id, { photoStoragePath: result.path },
currentUser.displayName, "Attached photo")` fire. Any failure (thrown error or `result.error`)
  is swallowed silently — the fluid event stays saved, `photoStoragePath` simply isn't set, and
  `navigate("/")` still runs. Matches acceptance criteria 3 and 4.
- Attaching a photo without requesting an estimate is unaffected — `onAttach` and `onAcceptEstimate`
  are independent callbacks, and none of the existing status-setting code paths (approx-amount grid,
  "Other approximate amount", container-fraction grid, exact-volume, unknown-amount) were touched.

**Verification**: `npm run build` (tsc -b + vite build) passed with no type errors. `npm run test`
passed (6 test files, 49 tests, no regressions — `IntakeFlowPage` has no existing test suite to
extend, consistent with the Context note that only `src/App.tsx` references this file).

No other files were touched (`VoicePage.tsx` / issue #0015 untouched, as scoped).
