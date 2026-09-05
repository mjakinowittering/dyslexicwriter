---
name: models-validation
description: How to author the Valibot schemas in `src/lib/models/*.model.ts` — the single source of truth for the shape of anything read off disk, and the key-by-key parse that keeps one bad value from costing every other setting. Load when creating or editing a `*.model.ts` file, adding a persisted preference, declaring a reusable picklist, or inferring a type via `v.InferOutput`.
---

# Models — Valibot schemas and inferred types

`src/lib/models/` owns the shape of anything the app does not create itself, and
the TypeScript types inferred from those shapes. There are four files and there
is no server, no database and no ORM — the only untrusted input in this app is
`config.json`, a file in the user's own folder that they may hand-edit, truncate,
or have written with an older version.

| File                | Owns                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| `config.model.ts`   | `config.json`: the schema, the defaults, and the key-by-key safe parse |
| `tts.model.ts`      | Read-aloud voice/rate bounds, shared by the schema and the settings UI |
| `prettier.model.ts` | Markdown print width and wrap mode, shared by the schema and formatter |
| `document.model.ts` | Title sanitisation, path helpers, `DocumentIndexEntry` — **no schema** |

## Not everything here is a schema

`document.model.ts` is deliberately a plain interface plus pure functions.
`DocumentIndexEntry` is built by `scanFolder` from a real file handle the browser
just gave us, so there is no untrusted input to validate — the folder on disk is
the only source this list has ever had. Wrapping it in Valibot would be
ceremony that validates our own output.

**Reach for a schema when the value came from outside the app.** Today that is
`config.json` and nothing else.

## The key-by-key parse — the important part

`parseConfig()` does **not** run one `v.safeParse` over the whole object. It
layers, key by key:

```
FALLBACK_PREFERENCES   in-code, last resort
  ← defaults.json      the shipped first-run values
    ← config.json      whatever the user has on disk
```

Each layer is applied through `pick(schema, value, fallback)`, which safe-parses
one value and falls back rather than throwing. That is the whole point: a
hand-edited `rate` of `0.4` costs the writer their reading speed and **nothing
else** — not their theme, not their font, not their chosen voice. One
whole-object parse would throw all four away over one typo.

`defaults.json` is layered the same way for the same reason: it is a checked-in
file like any other, and a typo in it must not propagate into a fresh
`config.json`. `FALLBACK_PREFERENCES` mirrors it in code and takes over per key.

Keys this version does not know are dropped rather than carried through — an old
`documents` index parses fine, is ignored, and goes for good on the next write.

## Adding a persisted preference

Four steps, and the first two are **one commit** — the pairing is an invariant.

1. add the field to `preferencesSchema` in `config.model.ts` (it flows into
   `configSchema` from there), and teach `layerPreferences()` to `pick` it
2. add its first-run value to `config/defaults.json` **and** to
   `FALLBACK_PREFERENCES`
3. add a `setX()` on the workspace store that writes through `#persist`
4. read it from `workspace.config` where it is needed

`version` is structural rather than configurable, so it stays out of
`preferencesSchema` and out of `defaults.json` — the code owns it.

## Conventions

- A schema and the type inferred from it live in the same file. Infer with
  `v.InferOutput<typeof schema>`; **never** hand-write a type beside a schema
  that already describes it.
- Declare a reusable enum once as `… as const` and wrap it in `v.picklist(...)`,
  so the same list backs the schema and any UI that offers the choice —
  `themeValues`, `fontValues`.
- Bounds that the UI also needs are exported constants, not literals repeated in
  both places: `TTS_RATE_MIN` / `TTS_RATE_MAX` / `TTS_DEFAULT_RATE` are shared by
  the schema and the voice-settings control, so the slider cannot emit a rate that
  fails validation on the way back in from disk.
- `models/` is client-safe by definition — there is no server tier in this app to
  import from. See CLAUDE.md's General Rules.
- A schema wrapped in `v.pipe(v.object(...), v.check(...))` is **not** a plain
  object schema, so `v.omit` / `v.partial` do not work on it. Declare any derived
  schema standalone and repeat the checks inline.
