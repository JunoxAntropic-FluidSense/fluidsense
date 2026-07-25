# Issue #0018: Regression tests — calc/reliability treat photo-derived entries identically

- Parent contract: camera-drink-photos
- Status: open
- Created: 2026-07-25

## Problem

No test currently asserts that `calc.ts`/`reliability.ts` treat a photo-derived `approximate`/
`container_estimated` entry identically to any other entry of the same status. This plan's core
hard-rule-1 argument rests on that being true, so it should be locked in with a test.

## Acceptance criteria

- [ ] Test in `src/lib/calc.test.ts` (new case or describe block) constructs two `FluidEvent`s with
      identical `status`/`amountMl`/etc., differing only in one having `photoStoragePath` set, and
      asserts `calc.ts`'s output is identical between them.
- [ ] New `src/lib/reliability.test.ts` (doesn't exist yet) covers `reliability.ts`'s existing
      behavior at least for the `approximate`/`container_estimated` "moderate" trigger path, and
      asserts presence/absence of `photoStoragePath` doesn't change the reliability result.
- [ ] No production code changes in this issue — test-only.

## Context

### `calc.ts` (src/lib/calc.ts) — exports

- `eventsInWindow(events: FluidEvent[], patientId: string, start: Date, end: Date): FluidEvent[]`
- `computeBalance(events: FluidEvent[]): BalanceBreakdown` — the function relevant to this issue.
  Branches only on `e.direction`, `e.status`, `e.amountMl`, and `e.category` (via `IV_CATEGORIES`
  set of `iv_fluid`/`iv_medication`). It never reads `photoStoragePath` or any photo field, so two
  events identical except for `photoStoragePath` must already produce identical `BalanceBreakdown`
  output — this issue is a regression lock, not a fix.
- `describeUnmeasured(events: FluidEvent[]): string[]`
- `formatMl(ml: number, units?: "mL" | "L"): string`
- `formatMlPlain(ml: number, units?: "mL" | "L"): string`

### `calc.test.ts` (src/lib/calc.test.ts) — existing conventions

Uses vitest (`describe`/`it`/`expect`). Defines a local fixture builder:

```ts
function ev(partial: Partial<FluidEvent>): FluidEvent {
  return {
    id: Math.random().toString(),
    patientId: "p1",
    direction: "intake",
    category: "water",
    unit: "mL",
    status: "measured",
    eventTime: new Date().toISOString(),
    recordedTime: new Date().toISOString(),
    enteredBy: "Test",
    inputMethod: "manual",
    ...partial,
  };
}
```

Tests live in a single `describe("computeBalance", ...)` block with one `it(...)` per behavior,
building `events` arrays via `ev({...})` and asserting on individual `BalanceBreakdown` fields
(e.g. `balance.totalIntakeMl`). A new case for this issue fits as another `it(...)` in that same
describe block, e.g. build two `ev({...})` events with identical `direction`/`category`/
`amountMl`/`status`, one with `photoStoragePath: "p1/e1.jpg"` added via `partial`, then assert
`computeBalance([a])` deep-equals `computeBalance([b])`.

### `reliability.ts` (src/lib/reliability.ts) — exports

- `computeReliability(windowEvents: FluidEvent[], periodLabel: string, periodStart: Date, periodEnd: Date): ReliabilityResult`
  is the sole export (plus unexported helpers `largestGapHours`, `findLikelyDuplicates`). It does
  NOT take a `MonitoringPeriod` object — just plain `Date` bounds and a label string — so no
  `period.ts`/`MonitoringPeriod` fixture is needed; `period.ts` has no dependency on
  `reliability.ts` (confirmed via grep).
- The "moderate"/container-or-approximate-estimate reason string is produced only when
  `containerEstimates.length > 0 && reasons.length === 0` (reliability.ts:107-111):
  `` `${n} entr${n>1?"ies rely":"y relies"} on container or approximate estimates rather than exact measurement` ``
  where `containerEstimates = active.filter(e => e.status === "container_estimated" || e.status === "approximate")`.
  This only surfaces when no higher-priority reason exists (no unmeasured urine/heavy
  continence/vomit/diarrhoea/heavy sweat/documentation gaps/duplicate or implausible-amount
  warnings). Level becomes `"Moderate"` when `moderateTriggers` is true (`containerEstimates.length
  > = 1`among other ORed conditions) and`lowTriggers` is false.
- Minimal input to hit this path: a small `windowEvents` array with exactly one event having
  `status: "approximate"` (or `"container_estimated"`), `amountMl` set, `direction: "intake"`,
  ordinary `category` (e.g. `"water"`), `eventTime` inside `[periodStart, periodEnd]`, no other
  events causing gaps/duplicates/implausible amounts, `periodStart`/`periodEnd` close together
  (e.g. same day) so gap-hour thresholds aren't tripped, and `deleted` falsy/absent.

### `reliability.test.ts` — confirmed does not exist yet

`ls src/lib/` shows: amounts.ts, calc.test.ts, calc.ts, demoData.ts, eventMeta.ts, period.test.ts,
period.ts, reliability.ts, supabase, voice — no `reliability.test.ts`. New file should mirror
`calc.test.ts`'s style: vitest `describe`/`it`/`expect`, the same local `ev(partial)` fixture
helper, and assert on `ReliabilityResult` fields (`level`, `reasons`, `unmeasuredEventCount`,
`documentationGaps`, `unresolvedWarnings` — see src/types.ts:241-248).

### Dependency on #0007

`photoStoragePath` does not exist on `FluidEvent` yet (zero hits grepping `src/`). It's added by
sibling issue #0007 (same parent contract, open), inserted as an additive optional field after
`confidence?: number;` (types.ts:132). This issue depends on #0007 landing first — or the test must
cast the fixture, e.g. `ev({...} as Partial<FluidEvent> & { photoStoragePath: string })`, if
sequenced before #0007. `MeasurementStatus` is `"measured" | "container_estimated" | "approximate" |
"unmeasured"` (types.ts:31-32); `NUMERIC_STATUSES` = the first three (types.ts:42-46).

## Touch manifest

- `src/lib/calc.test.ts` — add one new `it(...)` to the existing `describe("computeBalance", ...)`
  block asserting `computeBalance` output is deep-equal for two otherwise-identical events differing
  only in `photoStoragePath` presence. No changes to the existing `ev()` fixture helper or other tests.
- `src/lib/reliability.test.ts` — new file. Local `ev(partial)` fixture helper mirroring
  `calc.test.ts`'s. `describe("computeReliability", ...)` with:
  - a test hitting the "moderate"/container-or-approximate-estimate reason path (one `approximate`
    or `container_estimated` intake event, no other triggers, `periodStart`/`periodEnd` same day),
    asserting `level === "Moderate"` and the reason string / `reasons` array contents.
  - a test asserting `photoStoragePath` presence/absence doesn't change the `ReliabilityResult`
    (deep-equal between two otherwise-identical event sets).
- No production code files touched (`src/lib/calc.ts`, `src/lib/reliability.ts` untouched).

## Resolution

Test-only change, no production code touched.

- `src/lib/calc.test.ts`: added `"produces identical output for events differing only in
photoStoragePath"` to the `describe("computeBalance", ...)` block — builds one `approximate`
  intake event, clones it with `photoStoragePath` added, and asserts `computeBalance` output is
  `toEqual` between the two.
- `src/lib/reliability.test.ts` (new file): local `ev(partial)` fixture matching `calc.test.ts`'s
  convention. Three tests in `describe("computeReliability", ...)`:
  - `"Moderate"` trigger via a single `approximate` intake event (4-hour window so the "no output
    recorded" documentation-gap reason doesn't also fire and mask the container/approximate reason).
  - Same trigger confirmed for `container_estimated` status.
  - `photoStoragePath` presence/absence produces an identical `ReliabilityResult` (`toEqual`).

Note: initial versions of the two "Moderate" tests used a 6-hour period window
(08:00–14:00), which unexpectedly tripped the `output.length === 0 && totalWindowHours >= 6`
documentation-gap branch in `reliability.ts`, producing "no output has been recorded in this
period" instead of the container/approximate reason. Narrowed the window to 4 hours
(08:00–12:00) to isolate the trigger under test, per the issue's guidance to keep
`periodStart`/`periodEnd` close enough that gap thresholds aren't tripped.

Test results:

- `npx vitest run src/lib/calc.test.ts src/lib/reliability.test.ts` — 2 files, 8 tests, all passed.
- `npm run test` (full suite) — 6 files, 49 tests, all passed.
