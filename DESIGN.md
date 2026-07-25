# FluidSense Design System — "Clearwater"

Generated with `ui-ux-pro-max` (style: **Accessible & Ethical** — high contrast, WCAG AAA,
large text, healthcare-appropriate). Replaces an earlier, uncommitted "Meadowlark" botanical
direction that was never wired into the app's CSS.

## Why this direction

FluidSense is used by patients, carers, nurses, and clinicians — often on a phone, often under
time pressure, sometimes by people with reduced vision or dexterity. The design brief prioritizes
legibility and calm over decoration:

- **Calm cyan + neutral ink**, not clinical white-and-red — avoids looking like an alarm panel.
- **High contrast text** (4.5:1+, most pairs exceed 7:1) for low-vision and older-adult users.
- **Large touch targets** (44px minimum, already the case in `Button`'s `md`/`lg`/`xl` sizes).
- Colors carry **semantic meaning about data provenance, never about clinical judgment** — see
  [Hard-rule constraints](#hard-rule-constraints) below.

## Colors

All tokens live in `src/index.css` under `@theme`. Component code references the token names
(`bg-intake-600`, `text-navy-800`, …), never raw hex — retheming happens in one file.

| Group     | Role                                         | Key value       | Notes                                                                                                                            |
| --------- | -------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `navy`    | Headings, primary text                       | `900` `#0f3341` | Deep teal-ink, not pure black — softer, matches the cyan family                                                                  |
| `intake`  | Intake events, primary actions, focus ring   | `600` `#0891b2` | Calm cyan                                                                                                                        |
| `output`  | Output events                                | `600` `#6952c4` | Violet — deliberately a different hue family from intake, kept far enough apart for color-blind distinction (not contrast alone) |
| `amber`   | Estimated / container-estimated measurements | `600` `#b45309` | Warm, unrelated to intake/output hues — "this number is a guess" needs to look different, not just be labeled different          |
| `fog`     | Unmeasured events, neutral surfaces/borders  | `600` `#52646a` | Cool neutral, matches the cyan-forward palette (previously purple-leaning)                                                       |
| `alert`   | Errors only                                  | `500` `#dc2626` | Restrained — not used anywhere balance-related                                                                                   |
| `success` | UI confirmations only (e.g. "Copied ✓")      | `500` `#059669` | New group. **Never** applied to fluid-balance figures — see below                                                                |

## Typography

```css
@import url("https://fonts.googleapis.com/css2?family=Figtree:wght@500;600;700;800&family=Noto+Sans:wght@400;500;600;700&display=swap");
```

- **Display (`h1`, `h2`, `h3`, `.font-display`):** Figtree — bold, modern, geometric warmth.
  Applied globally by tag selector in `index.css`, so no page needed edits.
- **Body:** Noto Sans — high x-height, excellent at small sizes, wide language coverage.
- Both replace the previous single `Inter` family.

## Component patterns (`src/components/ui/`)

- `Button` — added `cursor-pointer`, an `active:scale-[0.98]` press state (respects
  `prefers-reduced-motion`, already handled globally), and a smoother `transition-colors duration-200`.
- `Card` — shadow rgba updated to match the new `navy-900` hue; radius/structure unchanged.
- `Badge`, `ProgressBar`, `ReliabilityPill`, `PrototypeBanner` — unchanged code, restyled
  automatically via the token cascade.

## Hard-rule constraints

This app's `CLAUDE.md` sets two rules that directly shape color usage, not just copy:

1. **Measured vs. guessed must stay visually distinct** — `intake`/`output` (data direction) and
   `amber`/`fog` (certainty) are four genuinely different hues, not shades of one color, so the
   distinction survives grayscale/color-blind viewing, not just a legend.
2. **No clinical-decision language** — colors never encode "good" or "bad" about a patient's fluid
   balance. `success` green is reserved for UI-level confirmations (e.g. a copy action succeeding),
   never for balance figures, reliability scores, or output volumes. `alert` red is reserved for
   genuine errors (a failed save, a form validation issue), not for flagging a patient's numbers.

## Scope of this pass

Changed: `src/index.css` (tokens, fonts, global heading rule) and the six files in
`src/components/ui/`. Every page consumes these through Tailwind utility classes, so the new look
applies app-wide without page-level edits — deliberately, to avoid touching files that had
unrelated in-progress work (auth, photo capture) mixed into their diffs at the time this was done.

## Not done in this pass (candidates for a follow-up)

- **Emoji → SVG icons.** The skill's checklist flags emoji icons (🔔, 🎙️, ☀️, category icons like
  🥤💧) as a professionalism issue. Fixing this touches many more files (`QuickAddGrid`,
  `ActivityTimeline`, category icon maps, `ReminderBanner`, `WeatherNote`) and needs an icon set
  (Heroicons/Lucide) added as a dependency — a deliberate follow-up, not bundled here.
- Per-page layout/spacing polish beyond what the shared primitives already enforce.
