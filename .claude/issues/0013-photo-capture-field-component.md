# Issue #0013: Shared `PhotoCaptureField` UI component

- Parent contract: camera-drink-photos
- Status: open
- Created: 2026-07-25

## Problem

No reusable capture/preview/estimate UI widget exists for embedding in both the Add flow and the
Voice confirm screen.

## Acceptance criteria

- [ ] `src/components/photo/PhotoCaptureField.tsx` uses
      `<input type="file" accept="image/*" capture="environment">` for capture.
- [ ] Shows a preview of the captured photo, a way to retake/remove it, and — only when backend is
      configured — an "Estimate amount from photo" action that surfaces the AI estimate as a
      suggestion the user must explicitly accept, never silently applied.
- [ ] Suggested estimate is visibly labeled as a suggestion/approximate; no diagnostic-sounding copy
      anywhere in the component.
- [ ] Component is presentational/orchestration only — actual status-setting still happens via the
      existing approximate-amount / container-fraction UI paths (design decision: no new
      status-transition code).
- [ ] Accessible (labels, focus handling) consistent with the app's accessibility prefs (largeText,
      highContrast, reduceMotion) where applicable.

## Context

**Design system (`src/components/ui/`)** — plain function components, no CVA/clsx libs, just
template-literal Tailwind strings with a `className` passthrough prop appended last so callers can
override. Conventions to match:

- `Button.tsx`: `forwardRef`, `variant` (`primary|secondary|ghost|output|danger`) and `size`
  (`md|lg|xl`) maps of Tailwind classes, `icon`/`fullWidth` props, spreads `...rest`
  (`ButtonHTMLAttributes`), disabled state via `disabled:opacity-40 disabled:cursor-not-allowed`.
- `Card.tsx` / `CardHeading`: `rounded-3xl bg-white border border-navy-900/5 shadow-[...]` wrapper;
  `CardHeading` takes `children` + optional `action` node for a header-right slot.
- `Badge.tsx` exports `StatusBadge({status, className})` — keyed `Record<MeasurementStatus, string>`
  maps for color/icon/text, e.g. `approximate`/`container_estimated` render with
  `bg-amber-100 text-amber-700 border-amber-200`, icon `≈` (`aria-hidden="true"`), text "Approximate"
  / "Container estimate". This is the exact existing pattern for labeling an amount as
  approximate/estimated — **reuse `<StatusBadge status="approximate" />` (or `container_estimated`)
  for the AI-suggested amount rather than inventing new copy/styling**, and STATUS_LABEL /
  MeasurementStatus already live in `src/types.ts`.
- `Badge.tsx` also exports generic `Badge({children, tone, className})` for non-status pills.
- `ReliabilityPill.tsx` shows the same icon+label map pattern for a different enum.
- Buttons/cards use color tokens `intake-*`, `output-*`, `amber-*`, `alert-*`, `navy-*`, `fog-*`
  (Tailwind theme, not raw hex). Amber = "needs attention/approximate", alert = destructive/error.
- No component in `ui/` currently reads accessibility store state itself.

**Confirm/preview pattern reference** — `src/pages/VoicePage.tsx`'s `EventCandidateCard` is the
closest existing "AI suggestion the user must explicitly accept" UI:

- Renders the raw source (`"{transcriptShown}"` in italics) then a structured summary card with
  `<StatusBadge status={candidate.measurementStatus} />`.
- Nothing is applied until the user presses an explicit "Confirm and save" `Button` — the whole
  screen only ever mutates local component state (`candidates`) until that action; store writes
  (`addEvent`) happen solely in the `confirmAll` handler. `PhotoCaptureField` should follow the same
  shape: hold the estimate as local/prop state and expose an `onAccept`-style callback, never write
  to the store itself.
- Low-confidence/ambiguous output is boxed as `rounded-xl bg-amber-50 border border-amber-200 p-3`
  with `text-sm font-bold text-amber-700` heading — reuse this "amber advisory box" treatment for the
  photo estimate suggestion panel.
- Sibling issue `.claude/issues/0012-use-photo-capture-hook.md` specifies a `usePhotoCapture` hook
  (status machine mirroring `useVoiceCapture`'s `idle|requesting_permission|listening|...` shape,
  concretely something like `idle|capturing|processing|ready|error`) that will supply: a preview
  object URL, an "estimate" action gated by backend-configured, and an "attach without estimating"
  action, and never auto-persists. `PhotoCaptureField` is the presentational counterpart —
  expect it to consume that hook's return shape (or equivalent props threaded from a page) rather
  than doing its own fetch/orchestration.
- Backend-configured gating precedent: `src/lib/voice/transcribe.ts` exports
  `SERVER_STT_CONFIGURED = Boolean(import.meta.env.VITE_SUPABASE_URL && ...VITE_SUPABASE_ANON_KEY)`,
  and `VoicePage` conditionally renders copy/UI based on that constant. The photo estimate action
  should be gated the same way (an equivalent `*_CONFIGURED` boolean import, likely from a future
  `src/lib/photo/estimate.ts` per issue #0011), hiding the "Estimate amount from photo" action
  entirely when false rather than showing it disabled.
- Existing status-setting entry points to delegate to (per "no new status-transition code"): see
  `src/pages/IntakeFlowPage.tsx` around the container-fraction buttons (`setStatus("container_estimated")`,
  `setAmountMl(Math.round(container.fullVolumeMl * f.value))`) and approximate-amount buttons
  (`setStatus("approximate")`). `PhotoCaptureField` should surface its suggested amount and let the
  parent page's existing handlers apply it (e.g. via an `onAcceptEstimate(amountMl)` callback), not
  call `setStatus`/store mutations directly.

**Accessibility prefs (largeText/highContrast/reduceMotion)** — these are NOT read/branched-on
per-component. They're applied globally once in `src/components/nav/AppShell.tsx`:

```
useEffect(() => {
  document.documentElement.classList.toggle("large-text", accessibility.largeText);
  document.documentElement.classList.toggle("high-contrast", accessibility.highContrast);
  document.documentElement.classList.toggle("reduce-motion", accessibility.reduceMotion);
}, [accessibility]);
```

and consumed via plain CSS in `src/index.css`:

- `.large-text { font-size: 112.5%; }` — relies on rem/em-based sizing cascading, so
  `PhotoCaptureField` just needs to avoid fixed px font sizes / hard-coded pixel heights that would
  clip at 112.5% text (use Tailwind text-_/rounded-_ utility scale like the rest of the app).
- `.high-contrast { --color-fog-50: #ffffff; } .high-contrast body { color: #000; }` plus the
  `prefers-reduced-motion` media query and `.reduce-motion *` block force
  `animation-duration/transition-duration: 0.001ms !important`. Practical implication: any
  loading/pulse animation the component adds (cf. `VoicePage`'s `animate-ping` listening indicator)
  is automatically neutralized by this global rule — no manual `reduce-motion` branching needed in
  the component, just don't rely on animation to convey state (pair it with text, as VoicePage does
  with `role="status" aria-live="polite"`).
- Global focus style: `:focus-visible { outline: 3px solid var(--color-intake-600); outline-offset: 2px; }`
  — native interactive elements (button/input/label) automatically get this; don't override
  `outline` on the file input, preview remove/retake buttons, or the estimate action button.
- Accessible-label precedent: `VoicePage`'s hidden mic button uses `aria-label="Speak an entry"`; the
  text fallback uses a real `<label htmlFor>` bound to the `<textarea id>`. `PhotoCaptureField`'s
  file input should follow the same: a bound `<label htmlFor="photo-capture-input">` (visually
  hidden or visible per context) plus `aria-label` fallback, and status changes during
  processing/estimating should use `role="status" aria-live="polite"` like the transcribing/listening
  states in VoicePage.

No `src/components/photo/` directory exists yet, and no vision/photo estimate lib exists yet
(that's issue #0011, gated by `usePhotoCapture` from #0012). This component (#0013) is purely the
presentational shell — it must accept the estimate/preview data and callbacks as props (or via
`usePhotoCapture`) rather than doing capture/compression/upload itself.

## Touch manifest

- **Create** `src/components/photo/PhotoCaptureField.tsx` — the only file this issue touches.
  - Calls `usePhotoCapture()` internally (see "Hook consumption" rationale below) rather than
    accepting the hook's return value as a prop.
  - Reads (does not modify) `src/hooks/usePhotoCapture.ts`, `src/components/ui/Badge.tsx`
    (`StatusBadge`), `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`,
    `src/types.ts` (`MeasurementStatus`) as read-only dependencies.
  - No other file is created, modified, or deleted — no page wiring, no route changes, no store
    changes. Issues #0014 (Add flow) and #0015 (Voice flow) own consuming this component.

**Hook consumption decision:** `PhotoCaptureField` calls `usePhotoCapture()` internally rather than
receiving its return value as a prop. Rationale: (1) no existing component in this codebase wraps a
capture-style hook via prop-drilling its full return object — `VoicePage` calls `useVoiceCapture()`
directly in the page and reads `capture.status` etc. inline, it doesn't pass the hook's return value
down as a single prop to a child component; (2) `usePhotoCapture` already owns its own
lifecycle/cleanup (object-URL revocation on unmount, `cancelledRef` guards) — calling it once inside
`PhotoCaptureField` keeps that lifecycle scoped to wherever the field is mounted, which matches how
`useVoiceCapture` is scoped to `VoicePage`; (3) it keeps the props surface small and focused on the
two things a parent actually needs to react to (`onAcceptEstimate`, optional `onAttach`) instead of
threading ~10 hook fields through prop types by hand. Later issues (#0014, #0015) mount
`<PhotoCaptureField />` directly wherever a photo attach point belongs, each instance getting its own
independent hook instance/lifecycle.

## Resolution

Implemented `src/components/photo/PhotoCaptureField.tsx` as a self-contained presentational widget
that calls `usePhotoCapture()` internally (see Touch manifest for the prop-vs-internal-hook
rationale).

**Props:**

```ts
interface PhotoCaptureFieldProps {
  onAcceptEstimate: (amountMl: number) => void;
  onAttach?: (
    photo: {
      previewUrl: string;
      attach: (
        profileId: string,
        eventId: string
      ) => Promise<UploadPhotoResult>;
    } | null
  ) => void;
  label?: string; // capture-trigger label, default "Add a photo"
  className?: string;
}
```

**Behavior / states** (driven by `usePhotoCapture`'s `status`):

- `idle` — a single `secondary` `Button` labeled by `label`, bound to a visually-hidden
  `<input type="file" accept="image/*" capture="environment" id={inputId}>` via
  `<label htmlFor={inputId} className="sr-only">` + `aria-label`. Selecting a file calls
  `capture(file)`.
- `capturing` — `Card` with `role="status" aria-live="polite"` ("Reading photo…").
- `error` — amber advisory box (`rounded-xl bg-amber-50 border border-amber-200`) with
  `errorMessage` and a "Try again" button calling `reset()`.
- `ready`/`processing` (photo present) — preview `<img src={previewUrl}>` in a `Card`, "Retake"
  (resets then re-opens the file picker) and "Remove" (`reset()`) buttons; when `estimateAvailable`
  is true and no estimate has been requested yet, an "Estimate amount from photo" button calls
  `requestEstimate()`. While `processing`, an amber `role="status" aria-live="polite"` box reads
  "Estimating amount from photo…".
- Estimate result: `status: "ok"` renders an amber advisory box with `<StatusBadge status="approximate" />`
  (reused verbatim, no invented copy/styling), the suggested mL and optional container guess, framed
  as "— you decide whether to use this", plus "Use this amount" (fires `onAcceptEstimate(estimatedMl)`)
  and "Try again" buttons. `status: "unavailable" | "error"` renders the hook's message in the same
  amber box with `role="alert"`, no numeric suggestion.

**Consumption by a parent page:** mount `<PhotoCaptureField onAcceptEstimate={...} onAttach={...} />`
directly (each instance owns its own `usePhotoCapture` lifecycle, matching how `VoicePage` owns
`useVoiceCapture`). `onAcceptEstimate` is the only path that surfaces a numeric suggestion — the
parent applies it through its own existing status-setting handlers (e.g. `setStatus("approximate")`

- `setAmountMl(...)`, mirroring `IntakeFlowPage`'s approximate-amount buttons); this component never
  calls `setStatus`, `addEvent`, or `updateEvent` itself. `onAttach` fires whenever a photo becomes
  ready (and with `null` on remove/reset), handing the parent a bound `attach(profileId, eventId)` the
  parent can invoke later — typically at save time once those IDs exist — so the actual upload
  (`uploadDrinkPhoto`) stays caller-initiated rather than something this component decides to do on its
  own.

**Accessibility:** bound `<label htmlFor>` + `aria-label` on the file input (VoicePage's
`aria-label="Speak an entry"` precedent), `role="status" aria-live="polite"` on processing/reading
states (VoicePage's transcribing/listening precedent), no fixed px sizes (Tailwind text-_/rounded-_
scale throughout, so `.large-text`'s 112.5% scaling doesn't clip), no manual `reduce-motion`
branching (no animation used to convey state — text + `aria-live` carry it), and no `outline`
overrides on the input/buttons so the global `:focus-visible` ring is preserved.

**Hard rule compliance:** no diagnostic language anywhere (copy is "Reading photo…", "Suggested
amount", "you decide whether to use this", never a clinical conclusion); estimated amounts are always
labeled via the existing `StatusBadge status="approximate"` and only become numeric state in the
_parent_ once the user explicitly presses "Use this amount" — never auto-applied, matching CLAUDE.md
rule 1 (never blur measured vs guessed) and rule 4 (voice/photo entries never save without explicit
confirmation).

**Build:** `npm run build` (tsc -b + vite build) passes clean. `npm run lint` (oxlint) shows only two
pre-existing warnings in `src/hooks/useFluidData.ts`, unrelated to this change.

**Scope:** only `src/components/photo/PhotoCaptureField.tsx` was created; no other file was touched.
