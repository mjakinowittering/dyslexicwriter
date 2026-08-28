---
name: testing
description: The Vitest strategy — what is worth testing in an app whose only job is not losing the user's writing, the three vitest projects (server/client/storybook), and the OPFS filesystem harness. Load when writing tests, or before committing changes to the markdown round-trip, `lib/fs/`, or the models.
---

# Testing

Vitest, three projects, configured inside `vite.config.ts` (there is no separate
vitest config):

| Project     | Environment           | Picks up                                                      |
| ----------- | --------------------- | ------------------------------------------------------------- |
| `server`    | node                  | `src/**/*.{test,spec}.ts` — pure logic (models, text-map)     |
| `client`    | chromium (playwright) | `*.svelte.{test,spec}.ts` **and** `src/tests/lib/markdown/**` |
| `storybook` | chromium              | every story, as a render smoke test                           |

Every suite lives under `src/tests/`, mirroring the source tree — a test for
`src/lib/fs/documents.ts` is `src/tests/lib/fs/documents.svelte.test.ts`. Shared
harnesses go in `src/tests/support/`; a harness component used by one suite sits
beside that suite.

The bar is not coverage. It is: **the things that could lose or corrupt the user's
writing are tested, and tested against something real.**

## Priorities

1. **The markdown round-trip** (`tests/lib/markdown/round-trip.test.ts`) — every
   supported node asserted byte-identical through markdown → JSON → markdown. This
   is the test that decides whether a node may exist in the editor at all. Add a
   case in the same commit as any new node or mark.
2. **The filesystem layer** (`tests/lib/fs/documents.svelte.test.ts`) — save,
   reopen, rename, delete, images. Especially: a refused rename leaves the source
   intact, and images travel with a renamed folder.
3. **The autosave lifecycle** (`tests/lib/stores/document.svelte.test.ts`) — the
   debounce, the flush, and above all that a failed write leaves the document
   dirty rather than swallowing the edit.
4. **Title sanitisation** (`tests/lib/models/document.model.test.ts`) — titles
   become path segments, so traversal, control characters, reserved names and
   length caps all have cases.
5. **The TTS offset map** (`tests/lib/tts/text-map.test.ts`) — the fragile part of
   read-aloud; round-trips doc text at mapped positions against the utterance.
6. **Schema fallbacks** (`tests/lib/models/tts.model.test.ts`, `fs/config.ts`) —
   `config.json` is hand-editable, so invalid input must degrade to defaults
   rather than throw.

## Test against the real API, not a mock

The fs and store suites run in the browser project against **OPFS**
(`navigator.storage.getDirectory()`), which returns genuine
`FileSystemDirectoryHandle` objects — the same interface the app drives against
the user's chosen folder. Mocking the filesystem here would test the mock; this
tests the ordering that actually protects the user's documents.

The harness is `src/tests/support/opfs.ts` — `emptyRoot()` plus `writeRaw` /
`readFile` / `fileExists` / `directory`, each taking the root explicitly so a
suite can bind it once. `emptyRoot()` clears OPFS, so call it in `beforeEach` and
tests stay independent.

The document store is driven the same way: `workspace.root` is public `$state`, so
a test assigns an OPFS root to it and every write underneath is real.

Likewise, the markdown converters run in chromium rather than node because they go
through `@tiptap/html`'s browser build and need a real DOM — which is also exactly
how they run in production.

## Coverage

`npm run test:coverage`. `coverage.include` is the whole of `src/**/*.{ts,svelte}`
(minus paraglide, stories, tests and `components/ui/`), so a module **nothing
imports still shows as 0%** rather than vanishing from the table — which is the
only way the report is worth reading. There is no `thresholds` gate: the number is
a map of where the risk sits, not a pass mark.

## Rules

- `expect.requireAssertions` is on: every test must assert something.
- Tests live under `src/tests/`, mirroring the source tree — never beside the
  module they test. Import the subject through `$lib/…`, never a relative path.
- A `.svelte.test.ts` suffix routes a test to the browser project — use it for
  anything needing a DOM or OPFS, not just component tests. It is a routing
  mechanism, not a naming habit: `fs/config.ts` has no runes and its suite is
  still `config.svelte.test.ts`.
- Run `npx vitest run` green before any commit touching `lib/fs/`,
  `lib/markdown/`, or `lib/models/`.
