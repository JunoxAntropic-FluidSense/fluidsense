# Issue #0017: Privacy copy update

- Parent contract: camera-drink-photos
- Status: open
- Created: 2026-07-25

## Problem

`PrivacyPage` doesn't disclose photo capture or third-party vision processing of drink photos.

## Acceptance criteria

- [ ] Discloses that photos may be captured, stored in Supabase Storage, and — if the user requests
      an estimate — sent to a third-party vision provider for processing.
- [ ] Copy avoids diagnostic/clinical language, consistent with hard rule 2.
- [ ] Consistent tone/structure with existing `PrivacyPage` sections (e.g. voice transcript
      disclosure, if present).

## Context

- `src/pages/PrivacyPage.tsx` (69 lines) is a single functional component with a fixed section
  pattern: each topic is a `<section className="space-y-2">` containing an
  `<h2 className="font-bold text-navy-900">` heading (title case, 2-4 words) followed by one
  `<p className="text-sm text-fog-700">` paragraph, 2-4 sentences.
- Closest structural/tone precedent: "Voice data" section, `src/pages/PrivacyPage.tsx:29-38` —
  discloses what's captured, when, why, and what the user controls ("You can choose in Profile
  whether..."). A new "Photo data" section should follow immediately after it, before "Demo mode"
  (`PrivacyPage.tsx:40`), matching that structure and plain, procedural tone (no
  hedging/marketing language).
- Also relevant: "What's stored" section, `src/pages/PrivacyPage.tsx:18-27`, which names storage
  locations plainly (device local storage / "a database you control") — model for disclosing
  Supabase Storage.
- `saveVoiceTranscripts: boolean` lives on `AppUser` (`src/types.ts:26`), used in
  `src/store/useStore.ts:140,322,421` and `src/pages/VoicePage.tsx:136,179` as the precedent for
  user-controlled retention, referenced by the Voice data section's "You can choose in Profile..."
  sentence — a similar sentence should exist for photos if a retention/deletion control applies.
- CLAUDE.md hard rule 2 (`CLAUDE.md:59-61`): "No diagnostic or clinical-decision language,
  anywhere. No 'dehydration,' 'AKI,' 'fluid overload,' or similar — the app reports what was
  recorded and how complete that record is, and never concludes on the user's behalf." New copy
  must stay purely descriptive (what's captured/stored/sent), never interpret the photo content.

## Touch manifest

- `src/pages/PrivacyPage.tsx` — the only file modified by this issue. Adds one new `<section>`
  ("Photo data") between the existing "Voice data" section (lines 29-38) and "Demo mode" section
  (line 40), matching the established `<section className="space-y-2">` /
  `<h2 className="font-bold text-navy-900">` / `<p className="text-sm text-fog-700">` pattern. No
  other file is touched (no `AppUser`/store changes — there is no existing user-controlled photo
  retention toggle to reference, unlike the Voice data section's `saveVoiceTranscripts` mention, so
  none is invented).

## Resolution

Added a "Photo data" section to `src/pages/PrivacyPage.tsx`, positioned immediately after "Voice
data" and before "Demo mode", using the identical section/heading/paragraph structure and Tailwind
classes as every other section on the page.

Copy discloses, purely descriptively: photos attached to a drink entry are stored in Supabase
Storage; if the user requests an amount estimate, the photo is sent to a third-party vision provider
for processing; the image is read into memory for that single request and discarded afterward —
FluidSense's own server does not retain a copy. This last claim is grounded directly in issue
#0010's Edge Function design ("Image is read into memory and discarded after use — the function
does not persist it"), so it states only what FluidSense's server does, not an unverifiable claim
about the third-party provider's internal retention policy.

No diagnostic/clinical language used (hard rule 2) and no real patient-identifiable information
introduced (hard rule 3). `npm run build` passes with no TS/JSX errors after the change.
