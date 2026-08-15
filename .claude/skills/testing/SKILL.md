---
name: testing
description: The Vitest strategy — what is worth testing in an app whose only job is not losing the user's writing, the three vitest projects (server/client/storybook), and the OPFS filesystem harness. Load when writing tests, or before committing changes to the markdown round-trip, `lib/fs/`, or the models.
---

# Testing

Vitest, three projects, configured inside `vite.config.ts` (there is no separate
vitest config):

| Project     | Environment           | Picks up                                                  |
| ----------- | --------------------- | --------------------------------------------------------- |
| `server`    | node                  | `src/**/*.{test,spec}.ts` — pure logic (models, text-map) |
| `client`    | chromium (playwright) | `*.svelte.{test,spec}.ts` **and** `src/lib/markdown/**`   |
| `storybook` | chromium              | every story, as a render smoke test                       |

The bar is not coverage. It is: **the things that could lose or corrupt the user's
writing are tested, and tested against something real.**

## Priorities

1. **The markdown round-trip** (`markdown/round-trip.test.ts`) — every supported
   node asserted byte-identical through markdown → JSON → markdown. This is the
   test that decides whether a node may exist in the editor at all. Add a case in
   the same commit as any new node or mark.
2. **The filesystem layer** (`fs/documents.svelte.test.ts`) — save, reopen,
   rename, delete, images. Especially: a refused rename leaves the source intact,
   and images travel with a renamed folder.
3. **Title sanitisation** (`models/document.model.test.ts`) — titles become path
   segments, so traversal, control characters, reserved names and length caps all
   have cases.
4. **The TTS offset map** (`tts/text-map.test.ts`) — the fragile part of
   read-aloud; round-trips doc text at mapped positions against the utterance.
5. **Schema fallbacks** (`models/tts.model.test.ts`) — `config.json` is
   hand-editable, so invalid input must degrade to defaults rather than throw.

## Test against the real API, not a mock

`fs/documents.svelte.test.ts` runs in the browser project against **OPFS**
(`navigator.storage.getDirectory()`), which returns genuine
`FileSystemDirectoryHandle` objects — the same interface the app drives against
the user's chosen folder. Mocking the filesystem here would test the mock; this
tests the ordering that actually protects the user's documents.

The harness clears OPFS in `beforeEach`, so tests are independent.

Likewise, the markdown converters run in chromium rather than node because they go
through `@tiptap/html`'s browser build and need a real DOM — which is also exactly
how they run in production.

## Rules

- `expect.requireAssertions` is on: every test must assert something.
- Tests live next to what they test.
- A `.svelte.test.ts` suffix routes a test to the browser project — use it for
  anything needing a DOM, not just component tests.
- Run `npx vitest run` green before any commit touching `lib/fs/`,
  `lib/markdown/`, or `lib/models/`.
