# FluidSense

A mobile-first, voice-enabled fluid intake and output tracking **prototype**. Built for patients, family carers, nurses, healthcare assistants and clinicians to record and review fluid balance quickly — by tapping, by voice, or by typing.

> **FluidSense is currently a prototype and must not be used as the sole basis for clinical decisions.** Do not enter NHS numbers, hospital numbers, real names, dates of birth, addresses, or any other real patient-identifiable information.

## Core idea

FluidSense never blurs the line between what's actually known and what's guessed. Every entry is tagged as one of:

- **Measured** — an exact volume was measured (e.g. 500 mL urine in a bottle).
- **Container-estimated** — a fraction of a known container (e.g. half a 300 mL mug).
- **Approximate** — a rough amount (e.g. "about one cup", "small vomit").
- **Unmeasured** — an event happened but no volume is known (e.g. urine passed into the toilet).

These are visually distinct everywhere in the app, and the "recorded balance" is always shown alongside a transparent, rule-based **reliability indicator** (High / Moderate / Low) that explains _why_ — because incomplete data should never be presented as a precise measurement of someone's true fluid status.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 (custom navy/teal/purple/amber/grey design system)
- React Router
- Zustand, persisted to `localStorage` — structured behind a single store module so a real backend (Supabase, below) can be dropped in without touching the UI layer
- Voice: `MediaRecorder` audio capture → a Supabase Edge Function → a configurable server-side speech-to-text provider, with the browser's built-in speech recognition as an automatic fallback when no server is configured (or it's unreachable) — never the only implementation. A deterministic normalisation/classification pipeline (`src/lib/voice/`) turns the transcript into one or more structured, confirmable events; nothing is ever saved without explicit confirmation
- Vitest for unit/integration tests

## Getting started

```bash
npm install
cp .env.example .env.local   # see "Environment variables" below
npm run dev
```

Open the printed local URL (defaults to `http://localhost:5173`). A brand-new account starts with **zero data** and walks through a short onboarding flow (patient/carer vs. healthcare professional). To see the app fully populated instead, click **Explore demo** on the landing page — demo mode uses entirely fictional, locally-generated data and never touches your real account's storage.

```bash
npm run build      # type-check + production build
npm run preview    # preview the production build
npm run test        # run the test suite once
npm run test:watch  # run tests in watch mode
```

## Environment variables

All frontend-exposed variables must be prefixed `VITE_` (Vite bundles them into the client build — never put a real secret there). See `.env.example` for the full list with comments. Summary:

| Variable                 | Where it's used                             | Required?                                                                                                                       |
| ------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_ENABLE_DEMO_MODE`  | Frontend                                    | No — defaults to enabled. Set to `false` to remove the "Explore demo" entry point and disable demo mode entirely in production. |
| `VITE_SUPABASE_URL`      | Frontend                                    | No — without it, the app runs entirely on local `localStorage` and voice falls back to the browser's built-in recognition.      |
| `VITE_SUPABASE_ANON_KEY` | Frontend                                    | Same as above. Safe to expose client-side — it's the public key, protected by row-level security, **not** a secret.             |
| `OPENAI_API_KEY`         | Server only (Supabase Edge Function secret) | No — only needed if you deploy the `transcribe` Edge Function. **Never** put this in a `VITE_`-prefixed variable.               |

Local dev, preview, and production should each have their own `.env.local` (gitignored) or hosting-provider environment configuration — never share one `.env` across environments, and never commit real values (only `.env.example` is tracked).

## Backend (optional): Supabase

The app works fully client-side with no backend at all. To add real persistence, authentication, and server-side voice transcription:

1. Create a Supabase project at [supabase.com](https://supabase.com) and grab the **Project URL** and **anon/public key** from Settings → API. Put them in `.env.local` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
2. Apply the schema: `supabase db push` (uses the migration in `supabase/migrations/0001_init.sql` — users, profiles, monitoring periods, fluid events, saved fluids, containers, edit history, weight/symptom events, reminders, and account-deletion requests, each locked down with row-level security so one account can never read another's data).
3. Deploy the transcription proxy: `supabase functions deploy transcribe`, then `supabase secrets set OPENAI_API_KEY=sk-...`. This function holds the speech-to-text provider key server-side — it's never present in frontend code.

Without this configured, the app is not broken — it just keeps using local storage and the browser's built-in speech recognition, exactly as designed.

## Structure

```
src/
  types.ts              # data model (events, profiles, monitoring periods, reliability, ...)
  lib/
    calc.ts, reliability.ts, period.ts   # balance calculation, reliability rules, time windows
    voice/                                # normalisation, classification, multi-event extraction, transcription client
  store/useStore.ts     # Zustand store — the only place that touches persistence; also owns demo-mode isolation
  hooks/                # useFluidData, useVoiceCapture, useOnlineStatus, ...
  components/           # design system, navigation, Today-screen widgets, ErrorBoundary
  pages/
    onboarding/          # WelcomePage, OnboardingFlow
    ...                  # Today, Add, Voice, History, Summary, Dashboard, DataSettings, Privacy, Terms, ...
supabase/
  migrations/0001_init.sql   # Postgres schema + RLS policies
  functions/transcribe/      # Edge Function proxying audio to a speech-to-text provider
```

## Testing

`src/lib/voice/extractEvents.test.ts`, `src/lib/calc.test.ts`, and `src/lib/period.test.ts` cover the calculation engine, time-window logic, spoken-number/unit normalisation, and intake/output classification — including every phrase from the product spec's required test list (unit conversions, "two fifty" style numbers, container fractions, ambiguous direction, multi-event sentences, and summary-request recognition).

## Deploying

This is a static Vite build — `npm run build` produces a `dist/` folder deployable to any static host (Vercel, Netlify, Cloudflare Pages, etc.). Set the environment variables for that environment in the hosting provider's dashboard, not in a committed file. The production build never seeds demo data automatically and includes no debug panels — demo mode is only ever entered explicitly by clicking "Explore demo".

## What this is not

This is a demonstration MVP. It must never be used to make real treatment or monitoring decisions, does not diagnose or prescribe, and — unless you've connected your own Supabase project — does not connect to any backend or real clinical system at all.
