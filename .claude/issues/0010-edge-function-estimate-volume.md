# Issue #0010: Edge Function `estimate-volume`

- Parent contract: camera-drink-photos
- Status: open
- Created: 2026-07-25

## Problem

No server-side proxy exists for a vision-based volume-estimation call. Calling a vision API directly
from the client would require exposing a provider secret in a `VITE_`-prefixed variable, which
CLAUDE.md prohibits.

## Acceptance criteria

- [ ] `supabase/functions/estimate-volume/index.ts` modeled on
      `supabase/functions/transcribe/index.ts`'s structure (Deno Edge Function, secret read via
      `Deno.env`, same CORS handling pattern).
- [ ] Accepts an image (base64 or multipart) and returns a **closed** JSON schema exactly:
      `{ estimatedMl: number, visibleFillFraction?: number, containerGuess?: string }` — no free-text
      reasoning/description field is ever returned to the client.
- [ ] System prompt instructs the model to avoid diagnostic/clinical language, as defense-in-depth —
      the closed schema (no free-text channel) is the primary guard, not the prompt.
- [ ] Image is read into memory and discarded after use — the function does not persist it.
- [ ] Provider secret set via `supabase secrets set`, never in a `VITE_` variable.

## Context

Precedent: `supabase/functions/transcribe/index.ts` (full file, 99 lines) is the structural model to
mirror exactly for boilerplate:

- Header comment stating purpose, `supabase functions deploy estimate-volume`, and
  `supabase secrets set <PROVIDER_KEY>=...`, plus a one-line "image is read into memory and discarded"
  note (mirrors transcribe's audio note).
- Secrets/config read once at module scope via `Deno.env.get(...)`, e.g. a vision-capable provider key
  (transcribe uses `OPENAI_API_KEY`; reuse the same var name if the same provider covers vision, or
  introduce one dedicated key) and `ALLOWED_ORIGIN` (`Deno.env.get("ALLOWED_ORIGIN") ?? "*"`).
- Identical `corsHeaders` object and identical `Deno.serve` control flow: OPTIONS → `200 "ok"`;
  non-POST → 405 JSON `{ error }`; missing secret → 503 JSON `{ error: "<capability> is not configured
on the server." }`; everything inside one `try { ... } catch (err) { 500 JSON { error, detail:
String(err) } }`.
- Request parsing: mirror transcribe's `req.formData()` + `instanceof File` pattern for a multipart
  image field (e.g. `form.get("image")`), 400 JSON if missing/wrong type — simplest path, avoids
  hand-rolling base64 decoding, and matches the existing precedent's shape exactly.
- Upstream call: a chat/vision-completion request (not the audio endpoint transcribe uses) with (a) a
  system prompt instructing structured, closed-schema JSON output and explicitly forbidding
  diagnostic/clinical language per CLAUDE.md hard rule 2 (quoted below), and (b) the provider's
  structured-output/JSON-schema mode constrained to exactly `{ estimatedMl: number,
visibleFillFraction?: number, containerGuess?: string }` — the schema constraint is the primary
  guard, the prompt wording is defense-in-depth only, since no free-text field exists to leak into.
- Non-ok upstream → 502 JSON `{ error: "<Provider> error.", detail }` (mirrors transcribe). On success,
  parse the upstream JSON and re-serialize _only_ the three allowed keys before returning to the client
  (do not pass the provider's raw response through) — this is the concrete enforcement of "no free-text
  reasoning field is ever returned," independent of whatever the provider actually sent back.
- No `deno.json`, `import_map.json`, or `supabase/config.toml` exist in this repo — transcribe has none
  and estimate-volume should follow suit (no new config files needed); deployment/secrets are purely
  CLI-driven per the header-comment convention.

CLAUDE.md hard rule 2 (exact wording, ground the system prompt in this):
"No diagnostic or clinical-decision language, anywhere. No "dehydration," "AKI," "fluid overload," or
similar — the app reports what was recorded and how complete that record is, and never concludes on the
user's behalf. This applies to UI copy, reliability-reason strings, and code comments alike."

Downstream consumer: issue #0011 (`src/lib/photo/estimateVolume.ts`) will POST to
`${VITE_SUPABASE_URL}/functions/v1/estimate-volume` with an `Authorization: Bearer
${VITE_SUPABASE_ANON_KEY}` header (same call shape as `src/lib/voice/transcribe.ts` uses today for the
`transcribe` function) and expects a typed "unavailable" result rather than a thrown error when
Supabase isn't configured — matching transcribe's existing fallback contract.

## Touch manifest

- `supabase/functions/estimate-volume/index.ts` (new file) — the only file created or modified by
  this issue. `supabase/functions/transcribe/index.ts` was read for structural precedent but is not
  edited. No other files in the repo are touched.

## Resolution

Created `supabase/functions/estimate-volume/index.ts`, mirroring
`supabase/functions/transcribe/index.ts`'s structure exactly:

- Same header-comment convention (purpose, `supabase functions deploy estimate-volume`,
  `supabase secrets set OPENAI_API_KEY=...`, and a "read into memory and discarded" note for the
  image).
- Same module-scope secret reads: `OPENAI_API_KEY` (reused — OpenAI's chat-completions endpoint also
  serves vision, so no new key name was introduced) and `ALLOWED_ORIGIN` (`?? "*"`).
- Identical `corsHeaders` object and `Deno.serve` control flow: OPTIONS → `200 "ok"`; non-POST → 405;
  missing secret → 503 (`"Volume estimation is not configured on the server."`); everything else
  inside one `try/catch` → 500 on unexpected error.
- Request parsing follows transcribe's `req.formData()` + `instanceof File` pattern for `form.get("image")`,
  400 JSON if missing/wrong type.
- The image is read into memory (`arrayBuffer()` → base64 data URL) and never written to disk or any
  store; it goes out of scope once the function returns.
- Upstream call is OpenAI's `POST /v1/chat/completions` (vision, not the audio endpoint transcribe
  uses) with `model: "gpt-4o"`, a system prompt that names the closed schema as the primary guard and
  explicitly forbids diagnostic/clinical language (quoting the spirit of CLAUDE.md hard rule 2), and
  `response_format: { type: "json_schema", json_schema: {...} }` constrained to exactly
  `estimatedMl`, `visibleFillFraction`, `containerGuess` with `additionalProperties: false`.
- Non-ok upstream → 502 JSON `{ error: "Volume estimation provider error.", detail }`.
- On success, the upstream JSON is parsed and only the three allowed keys are manually re-serialized
  into the response body — the provider's raw response object is never passed through, so no
  free-text field can reach the client even if the model ignored the schema.
- No `deno.json`, `import_map.json`, or `supabase/config.toml` were added, matching the existing
  transcribe precedent (none exist in the repo).

Scope was kept strictly to the new file — `supabase/functions/transcribe/index.ts` was read only, not
modified, and no other files were touched.

**Caveat / limitation:** Deno is not installed in this environment, so the function could not be run
or deployed here. To validate syntax/types, the file was copied into a scratch directory and
type-checked with the repo's local `tsc` (`--target es2022 --lib es2022,dom --strict --skipLibCheck`)
against a minimal hand-written `declare namespace Deno { ... }` shim covering `Deno.serve` and
`Deno.env.get` — it passed with no errors. This confirms TypeScript syntax and typing consistency with
the transcribe precedent, but is not a substitute for an actual `supabase functions deploy` /
`deno check` run, which should happen before this function goes live.
