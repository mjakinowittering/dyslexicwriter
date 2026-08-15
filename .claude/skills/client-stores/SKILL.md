---
name: client-stores
description: The three runes stores — workspace (folder, config, document index), document (the open document, autosave and flush), and the theme/tooltip helpers. Load when editing anything in `src/lib/stores/`, wiring a new persisted setting, or changing the autosave lifecycle.
---

# Client stores

Plain Svelte 5 runes classes exported as singletons. There is no server, so there
is no fetching layer, no cache invalidation, and no conflict resolution — a store
here is just reactive state over the filesystem.

| Store                   | Owns                                                               |
| ----------------------- | ------------------------------------------------------------------ |
| `workspace.svelte.ts`   | The directory handle, the parsed `config.json`, the document index |
| `document.svelte.ts`    | The open document: content, title, word count, autosave and flush  |
| `theme.store.svelte.ts` | A thin wrapper over mode-watcher                                   |
| `tooltips.svelte.ts`    | The tooltip-suppression registry (see `[[animations]]`)            |

## Conventions

- `$state` fields are public and read directly by components; expose derived
  values as `get` accessors rather than recomputing in every consumer.
- Private machinery uses `#` fields. **Never** make a field `$state` if it holds
  ProseMirror positions or ranges — the proxy leaks into decorations (see
  `[[content-tts]]`).
- Async methods return `Promise<void>` and **swallow errors into an `error`
  field** rather than throwing: they are called from event handlers nobody awaits,
  and an unhandled rejection is an invisible failure.

## The workspace status machine

```
loading  ->  unsupported     (no File System Access API)
         ->  needs-folder    (nothing stored, or permission not granted)
         ->  ready           (handle + config in hand)
```

`restore()` runs on mount and only ever moves to `ready` silently. It never
prompts for permission, because Chromium requires a user gesture for that — the
picker button in the `needs-folder` state is that gesture.

## The autosave contract — the important part

`document.svelte.ts` is the only place the user's writing can be lost, so:

- `applyEdit()` marks dirty and (re)starts a ~600ms debounce.
- `flush()` cancels the timer and writes immediately. It is called on **blur**,
  **`pagehide`**, **`visibilitychange` → hidden**, **destroy**, and **before a
  rename**. The debounce is an optimisation; this list is the guarantee.
- Writes are serialised through a `#writing` promise chain, so a flush can never
  overlap an in-flight autosave.
- A failed write sets `#dirty` back to `true` so the next attempt retries, and
  surfaces a message the status bar renders. Never fail silently.

Full detail, including the rename ordering, is in `[[filesystem-storage]]`.

## Adding a persisted setting

Every persisted preference lives in `config.json` — no exceptions.

1. add the field to `preferencesSchema` in `models/config.model.ts` (it flows into
   `configSchema` from there) and teach `layerPreferences()` to `pick` it, so a
   corrupt value costs that key alone
2. add its first-run value to `config/defaults.json` **and** to the in-code
   `FALLBACK_PREFERENCES` — the pairing is an invariant, same commit
3. add a `setX()` method on the workspace store that writes through `#persist`
4. read it from `workspace.config` where it is needed

Do not reach for `localStorage`, `sessionStorage`, IndexedDB or a URL param.
IndexedDB holds the directory handle and nothing else.
