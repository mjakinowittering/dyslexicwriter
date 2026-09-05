---
name: client-stores
description: The two runes stores — workspace (folder, config, document tree) and document (the open document, autosave and flush). Load when editing anything in `src/lib/stores/`, wiring a new persisted setting, or changing the autosave lifecycle.
---

# Client stores

Plain Svelte 5 runes classes exported as singletons. There is no server, so there
is no fetching layer, no cache invalidation, and no conflict resolution — a store
here is just reactive state over the filesystem.

| Store                 | Owns                                                              |
| --------------------- | ----------------------------------------------------------------- |
| `workspace.svelte.ts` | The directory handle, the parsed `config.json`, the document tree |
| `document.svelte.ts`  | The open document: content, title, word count, autosave and flush |

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

Six states, not three — the three extra ones all exist because a stored handle
can outlive the writer's permission, or the folder itself.

```
loading  ->  unsupported        (no File System Access API)
         ->  needs-folder       (nothing stored: first run, or the folder was let go)
         ->  needs-permission   (a stored folder we may not touch until the user says so)
         ->  folder-missing     (a stored folder we may read and cannot find)
         ->  ready              (handle + config in hand)
```

`restore()` runs on mount and only ever reaches `ready` silently. It never
prompts, because Chromium requires a user gesture for that: a handle whose grant
has lapsed is held aside as `pending` and the welcome screen offers a **Reopen**
card, which is the gesture. Treating that as a first run would have hidden the
folder the writer already chose.

Permission outlives the folder — a deleted folder, a renamed one and an unmounted
drive all still report `granted` — so `restore()` and `reopen()` both call
`folderIsReachable()` before adopting, and land on `folder-missing` when it
answers no. The handle is deliberately kept there: nothing in the API can tell a
deleted folder from a drive that isn't plugged in this minute, and the second
comes back at the same path.

## The autosave contract — the important part

`document.svelte.ts` is the only place the user's writing can be lost, so:

- `applyEdit()` marks dirty and (re)starts the `AUTOSAVE_DEBOUNCE_MS` timer (5s
  from the last keystroke), under an `AUTOSAVE_MAX_WAIT_MS` ceiling (30s from the
  first unsaved edit, never extended) so unbroken typing still gets written.
- `flush()` cancels both timers and writes immediately. It is called on **blur**,
  **`pagehide`**, **`visibilitychange` → hidden**, **destroy**, and **before a
  rename**. The debounce is an optimisation; this list is the guarantee.
- `flush({ format: false })` skips the round trip to the formatting worker.
  `pagehide` and `visibilitychange` pass it, because both fire un-awaited on a page
  the browser may terminate at once and a message hop is not something they can
  wait for. The edit lands unwrapped and the next ordinary save tidies it — see
  `[[content-editor]]` for why formatting can never be allowed to fail a save.
- Writes are serialised through a `#writing` promise chain, so a flush can never
  overlap an in-flight autosave.
- A failed write sets `#dirty` back to `true` so the next attempt retries, and
  surfaces a message the status bar renders. Never fail silently.

**`applyEdit()` is a signal the store cannot verify, so the editor verifies it.**
`flush()` is a no-op on a clean document, which means one missed `onUpdate` takes
every exit path above down with it. `PageEditor.svelte` therefore compares
`editor.state.doc` against the last one it reported — ProseMirror nodes are
immutable, so identity is an exact, O(1) answer — on blur, on a
`CONTENT_CHECK_MS` heartbeat, and via its exported `reconcile()`, which the edit
page calls before every flush. That is what catches an edit made from outside the
editor: a browser extension rewriting the contenteditable raises no TipTap event.
Content loaded rather than typed (the constructor's, and the seeding effect's) is
recorded as already-reported, or opening a document would write it straight back.

Full detail, including the rename ordering, is in `[[filesystem-storage]]`.

## The document tree is state, not a cache

`workspace.tree` is the **only** copy of the list of documents. It is scanned from
the folder on adopt, on the Files screen's mount, and on window focus, and it is
written nowhere — not to `config.json`, not to browser storage. `touch()` moves a
row's mtime in memory after each autosave and that is the whole job; anything that
reaches for the disk here puts a round trip behind every keystroke that lands.

Read `isEmpty` and `hasUnopenableFiles` rather than counting documents — see
`[[filesystem-storage]]` for why the distinction matters.

## Adding a persisted setting

Every persisted preference lives in `config.json` — no exceptions. `config.json`
holds preferences and nothing else; state that can be scanned back off the folder
does not belong in it.

1. add the field to `preferencesSchema` in `models/config.model.ts` (it flows into
   `configSchema` from there) and teach `layerPreferences()` to `pick` it, so a
   corrupt value costs that key alone
2. add its first-run value to `config/defaults.json` **and** to the in-code
   `FALLBACK_PREFERENCES` — the pairing is an invariant, same commit
3. add a `setX()` method on the workspace store that writes through `#persist`
4. read it from `workspace.config` where it is needed

Do not reach for `localStorage`, `sessionStorage`, IndexedDB or a URL param.
IndexedDB holds the directory handle and nothing else.
