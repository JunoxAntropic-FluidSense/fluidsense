# Issue #0016: Render attached photos in History/edit views

- Parent contract: camera-drink-photos
- Status: open
- Created: 2026-07-25

## Problem

Nowhere in the app currently displays an attached photo once saved.

## Acceptance criteria

- [ ] `EventRow` shows a small thumbnail indicator when `photoStoragePath` is present, resolved via
      #0009's signed-URL helper.
- [ ] `EditEventModal` allows viewing (and optionally removing) the attached photo.
- [ ] Thumbnail/view never implies a status the entry doesn't have — e.g. does not visually suggest
      "measured" for an `approximate` entry just because it has a photo.
- [ ] Loading/error states for the signed-URL fetch are handled gracefully (no crash if Storage is
      unreachable).

## Context

### `EventRow` (src/components/EventRow.tsx, full file, 82 lines)

Renders one `FluidEvent` as an `<li>`: a category icon circle (lines 36-41), then a flex-1 column
with (a) a header row (line 43-51) holding the category label, `<StatusBadge status={event.status} />`
(line 47, from `./ui/Badge`), and an optional "(edited)" tag; (b) an amount/episode/subtype line
(52-60); (c) a timestamp/enteredBy/input-method line (61-66, uses `INPUT_METHOD_ICON`/`INPUT_METHOD_LABEL`
from `../lib/eventMeta`); (d) an optional note line (67-69). An optional "Edit" button sits at the far
right (71-79) when `onEdit` is passed. `FluidEvent` has no `photoStoragePath`/`photoSource` field yet
in `src/types.ts` — those are added by #0007 (additive, near end of interface after `confidence?:
number` at src/types.ts:132) and must land before this issue can reference them. A thumbnail indicator
fits most naturally as a small fixed-size element (e.g. next to/below the header row, or appended after
the note line) inside the existing `flex-1 min-w-0` column (line 42) — it should NOT replace or sit
inside the `StatusBadge`, and should not reuse status colors (see mapping below) so it reads as a
separate, neutral affordance.

### `EditEventModal` (src/components/EditEventModal.tsx, full file, 184 lines)

Local state mirrors editable fields: `amountMl`, `status` (`MeasurementStatus`, options list at
lines 9-14), `note`, `reason`, `confirmDelete` (lines 28-34). Body is a `space-y-4` div (76-136)
with labeled fields in order: measurement-status `<select>` (77-90), conditional volume input
(92-103, hidden when status is `unmeasured`), note input (105-112), reason-for-change input
(114-122), and a read-only edit-history block (124-135, rendered only if
`event.editHistory.length > 0`). Actions (Save/Delete) are below in a separate `mt-5 space-y-2` div
(138-180); `save()` (36-53) calls `updateEvent(event.id, { amountMl, status, note }, ...)` — it does
not currently touch any photo field, so a future save handler must be extended (or a separate
remove-photo action added) without breaking this contract. A photo view/remove affordance fits well
as its own labeled block inserted into the `space-y-4` field list (e.g. between the note field and the
edit-history block, lines 112-124), rendered conditionally on `event.photoStoragePath` being present
(field not yet in `FluidEvent`; depends on #0007) and fetched via #0009's `src/lib/photo/storage.ts`
signed-URL helper (not yet implemented — #0009's issue file still has an unfilled Context section, so
its exact export name/signature is not yet fixed; #0016 should treat it as "whatever #0009 lands").

### Status-to-visual mapping to preserve (src/components/ui/Badge.tsx, full file, 66 lines)

`StatusBadge` (lines 25-40) maps `MeasurementStatus` to fixed style/icon/text via three
`Record<MeasurementStatus, string>` tables:

- `STATUS_STYLE` (4-9): `measured` → intake green (`bg-intake-100 text-intake-700`);
  `container_estimated` and `approximate` → amber (`bg-amber-100 text-amber-700`); `unmeasured` →
  neutral fog gray (`bg-fog-100 text-fog-700`).
- `STATUS_ICON` (11-16): `measured` = "✓", `container_estimated`/`approximate` = "≈",
  `unmeasured` = "—".
- `STATUS_TEXT` (18-23): "Measured", "Container estimate", "Approximate", "Unmeasured" (same
  strings as `STATUS_LABEL` in src/types.ts:34-39).

This is the only status-visual encoding in the app (confirmed via grep — no other component maps
`MeasurementStatus` to color/icon). A new photo thumbnail/indicator must use a visually distinct
treatment (e.g. neutral gray/navy icon or an actual image thumbnail, no green/amber tinting matching
`STATUS_STYLE`) and must not appear only for `measured` entries or otherwise correlate its presence/
styling with `status` — acceptance criterion 3 ("does not visually suggest measured for an
approximate entry") maps directly onto not reusing `intake`/`amber` colors or the ✓/≈ glyphs from
`STATUS_ICON` for the photo affordance.

## Touch manifest

- `src/components/PhotoThumbnail.tsx` (new, small) — shared helper component. Fetches a signed URL via
  `getDrinkPhotoSignedUrl(path)` on mount (re-fetches on `path` change), tracks loading/error state
  locally, never throws (catches rejected promises). Renders a plain navy/fog camera-icon chip
  (`bg-fog-100 text-navy-500`, 📷 glyph) while loading or on error, and the actual `<img>` thumbnail
  once a signed URL resolves. Accepts a `size` prop (`sm` for `EventRow`, `md` for `EditEventModal`) so
  one component serves both call sites. Deliberately uses none of `StatusBadge`'s colors
  (intake green / amber / fog-as-status) or icons (✓/≈/—) — only fog/navy neutrals and a camera glyph,
  so presence of a photo never reads as a measurement-status signal.
- `src/components/EventRow.tsx` — import `PhotoThumbnail`; render it (`size="sm"`) in a small block
  appended after the existing note line (after line 69), conditional on `event.photoStoragePath`. Does
  not touch the `StatusBadge` usage on line 47 or the header row.
- `src/components/EditEventModal.tsx` — import `PhotoThumbnail`; insert a new labeled block into the
  `space-y-4` field list between the note field (105-112) and the edit-history block (124-135),
  conditional on `event.photoStoragePath`. Shows the thumbnail (`size="md"`) plus a "Remove photo"
  ghost button that calls `updateEvent(event.id, { photoStoragePath: undefined }, currentUser.displayName, reason || "Removed photo")` —
  matches `updateEvent`'s existing signature (src/store/useStore.ts:87-92); no changes to `save()` or
  the delete flow.

## Resolution

- Added `src/components/PhotoThumbnail.tsx`: fetches a signed URL via `getDrinkPhotoSignedUrl(path)`
  on mount/path-change, never throws (catches rejections), and renders a plain navy/fog camera-icon
  chip (📷, `bg-fog-100 text-navy-500`) while loading or on error, swapping to the real `<img>` once
  the signed URL resolves. Uses none of `StatusBadge`'s status colors or ✓/≈/— icons.
- `EventRow.tsx`: renders `<PhotoThumbnail size="sm" />` after the note line, conditional on
  `event.photoStoragePath`. `StatusBadge` usage untouched.
- `EditEventModal.tsx`: inserted a "Photo" labeled block between the note field and the edit-history
  block, conditional on `event.photoStoragePath`, showing `<PhotoThumbnail size="md" />` plus a
  ghost "Remove photo" button that calls
  `updateEvent(event.id, { photoStoragePath: undefined }, currentUser.displayName, reason || "Removed photo")`
  — matches the existing `updateEvent` signature; `save()` unchanged.
- All three acceptance criteria met: thumbnail shown via #0009's signed-URL helper, modal supports
  view + remove, no status-implying styling reused, and loading/error states degrade to a neutral chip
  with no crash.
- `npm run build` (tsc -b + vite build) passes with no errors.
