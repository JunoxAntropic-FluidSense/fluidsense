# CLAUDE.md

Guidance for Claude Code (and any other contributor, human or agent) working in this repository.

## What this is

FluidSense is a mobile-first, voice-enabled fluid intake/output tracker for patients, carers, nurses,
and clinicians — a **prototype**, not a certified clinical tool. Patient mode and healthcare mode share
one data model and calculation engine (`src/lib/calc.ts`, `src/lib/reliability.ts`), so every role looks
at the same underlying record through a different view.

For current build status and next steps, see `APP_PLAN.md` — don't duplicate that snapshot here.

## Stack

React 19 + TypeScript + Vite · Tailwind CSS v4 · React Router · Zustand (persisted to `localStorage`,
routed through `src/store/useStore.ts` as the only module that touches persistence) · Vitest.

Voice: `MediaRecorder` → Supabase Edge Function → server-side STT, with the browser's built-in speech
recognition as an automatic fallback when no server is configured. Backend (Supabase: auth, Postgres +
RLS, the `transcribe` function) is optional — the app runs fully client-side without it.

## Structure

```
src/
  types.ts              # data model — MeasurementStatus, FluidEvent, MonitoringPeriod, ReliabilityResult, ...
  lib/
    calc.ts, reliability.ts, period.ts   # balance calculation, reliability rules, time windows
    voice/                                # transcript normalisation, classification, multi-event extraction
  store/useStore.ts     # Zustand store — persistence + demo-mode isolation live here only
  hooks/                # useFluidData, useVoiceCapture, useOnlineStatus, ...
  components/           # design system (ui/), navigation (nav/), Today-screen widgets (today/)
  pages/                # Today, Add, Voice, History, Summary, Dashboard, DataSettings, onboarding/, ...
supabase/
  migrations/0001_init.sql   # Postgres schema + row-level security
  functions/transcribe/      # Edge Function proxying audio to a speech-to-text provider
```

## Commands

```bash
npm run dev          # dev server
npm run build         # type-check (tsc -b) + production build — run before considering work done
npm run test          # run the vitest suite once
npm run test:watch    # vitest in watch mode
npm run lint           # oxlint
```

## Hard rules

These encode the product's core identity. Treat them as blockers, not style preferences — flag or
refuse changes that violate them rather than working around them silently.

1. **Never blur measured and guessed.** Every `FluidEvent` carries one `MeasurementStatus`: `measured`,
   `container_estimated`, `approximate`, or `unmeasured` (`src/types.ts`). This four-way distinction must
   stay visually and computationally distinct everywhere — never collapse it into a single "amount," and
   never let an estimated or unmeasured entry render or calculate as if it were measured.
2. **No diagnostic or clinical-decision language, anywhere.** No "dehydration," "AKI," "fluid overload,"
   or similar — the app reports what was recorded and how complete that record is, and never concludes on
   the user's behalf. This applies to UI copy, reliability-reason strings, and code comments alike.
3. **No real patient-identifiable information, ever** — not in code, tests, fixtures, demo data, commit
   messages, or examples. No real NHS/hospital numbers, real names, real DOBs, real addresses. Demo data
   (`src/lib/demoData.ts`) is fictional by construction; keep it that way.
4. **Voice entries never save without explicit confirmation.** The pipeline (capture → transcribe →
   normalise → classify → confirm) always ends at a confirmation screen the user can edit or cancel —
   never wire a path that persists a voice-derived event automatically.

## Testing requirement

`calc.ts`, `reliability.ts`, `period.ts`, and anything under `src/lib/voice/` are spec-critical: the
existing suites (`calc.test.ts`, `period.test.ts`, `extractEvents.test.ts`) encode the product spec's
required phrase/behavior list (unit conversions, spoken numbers, container fractions, ambiguous
direction, multi-event sentences, summary-request recognition). Any change to these files must ship with
corresponding test updates in the same change — not as a follow-up.

## Conventions

- Prefer small, focused commits — one logical change each, rather than large multi-feature dumps.
- Frontend env vars must be prefixed `VITE_` (bundled into the client build). Never put a real secret
  (e.g. `OPENAI_API_KEY`) in a `VITE_`-prefixed variable — server-only secrets belong in Supabase Edge
  Function secrets, set via `supabase secrets set`.
- `src/store/useStore.ts` is the only place that should touch persistence or demo-mode isolation logic —
  don't reach into `localStorage` directly from components or pages.

## Relevant skills

- `tdd` — fits calc/voice-pipeline work given the testing requirement above (red-green-refactor).
- `run` — launch the dev server and drive the app in-browser to confirm a UI change actually works.
- `prototype` — for sanity-checking a state-model or UI idea before committing to it.
