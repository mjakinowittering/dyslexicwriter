---
name: filesystem-storage
description: The File System Access API data layer — `src/lib/fs/*`, the folder picker and persisted directory handle, `config.json`, the folder scan, save/rename/delete ordering, and image writes. Load when touching anything in `src/lib/fs/`, the workspace or document stores, the Files screen, autosave/flush, or when adding a persisted setting.
---

# Filesystem storage

There is no server and no database. The user picks one working folder, and that
folder **is** the app's storage. Everything in `src/lib/fs/` exists to read and
write it safely.

The bar for this domain is **not losing the user's writing**. A document is only
ever as safe as the last successful write, so ordering and flush behaviour matter
more than elegance here.

## File map

| File                         | Responsibility                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `fs/support.ts`              | `isFileSystemAccessSupported()` — feature detection for the unsupported screen                                         |
| `fs/handle-store.ts`         | The **only** IndexedDB use: one `FileSystemDirectoryHandle`, plus `ensurePermission`                                   |
| `fs/config.ts`               | `readConfig` / `writeConfig` / `updateConfig` over `config.json`                                                       |
| `fs/documents.ts`            | `scanFolder`, `readDocument`, `writeDocument`, `renameDocument`, `deleteDocument`, `writeImage`, `suggestUntitledName` |
| `stores/workspace.svelte.ts` | The chosen folder, the parsed config, the document index, and the `WorkspaceStatus` machine                            |
| `stores/document.svelte.ts`  | The open document: autosave debounce, flush, rename, image insert                                                      |

## On-disk shape

```
<working folder>/
├── config.json              <- ALL preferences + the document index
├── My Chapter/
│   ├── My Chapter.md        <- the document
│   └── diagram.png          <- images belong to the document that uses them
└── Another Draft/
    └── Another Draft.md
```

## The three storage rules

1. **The filesystem is the source of truth.** `contentJson` is a working copy that
   exists only while a document is open. Never cache document content in
   IndexedDB, `localStorage` or `sessionStorage`.
2. **IndexedDB holds exactly one thing** — the directory handle. It lives there
   because a handle is structured-cloneable but has no string form, so
   `localStorage` genuinely cannot store it. Nothing else may be added.
3. **Every persisted preference lives in `config.json`.** Theme, font, TTS
   voice/speed, and anything added later. No exceptions.

## Durability — the parts that are easy to get wrong

### Autosave debounces, but every exit path flushes

A debounce alone will drop the last edit when a tab closes mid-sentence. The
document store flushes on **blur**, **`pagehide`**, **`visibilitychange`** →
hidden, **component destroy**, and **before a rename**. Treat the debounce as an
optimisation and the flush list as the actual guarantee.

Writes are serialised through a promise chain (`#writing`) so a flush can never
overlap an in-flight autosave and land the two out of order.

### Derive the markdown BEFORE opening the writable

`writeDocument` calls `toMarkdown()` first, then opens the writable. Opening a
writable truncates the file, so serialising after that point means a throw leaves
an empty file where the user's chapter was.

### A failed save must return to the dirty state

On a write error the store sets `#dirty = true` again and surfaces the message.
The next keystroke or flush retries. Silently swallowing the error is how writing
gets lost.

### Rename: new folder first, old folder LAST

Chromium's `FileSystemHandle.move()` is reliable for files but **not for
directories**, so a rename is a copy followed by a delete:

1. create the destination folder
2. copy every file across, the markdown file taking the new name as it goes
3. only then `removeEntry` the source, recursively

Deleting last is what makes it safe: a failure at any point leaves the original
intact. The worst case is a duplicate folder, never a lost document. Renaming
fires on the title field's `change`/blur — **never** per keystroke.

### Confirm before deleting

`deleteDocument` removes a real folder from the user's disk and there is no trash.
Always confirm, and name what is being removed.

## Permissions can vanish at any time

A stored handle does not carry its permission grant across sessions.
`ensurePermission(handle)` queries silently; `ensurePermission(handle, { prompt:
true })` asks, and **must** be called from a user gesture or Chromium rejects it.
That is why `restore()` falls back to `needs-folder` rather than prompting: the
picker button is the gesture.

Any filesystem call can fail because the drive was unplugged or permission was
revoked. Handle it by surfacing a re-pick, never by discarding the in-memory
document.

## Validate everything read from disk

`config.json` is user-editable and may be hand-edited, truncated, or written by a
different version. It is parsed through `configSchema` (Valibot) via
`parseConfig`, which falls back to defaults rather than throwing. A corrupt
settings file must never stop the user reaching their writing.

The document index in `config.json` is a **cache for the Files screen**, not an
authority. `scanFolder` reconciles it; the folder on disk always wins.

## Titles become path segments

`sanitiseTitle()` in `models/document.model.ts` is the boundary. It strips path
separators, control characters, leading dots (which would hide the folder) and
trailing dots/spaces (which Windows drops silently, desyncing the index from
disk), suffixes Windows reserved device names (`CON`, `LPT1`, …), caps length, and
never returns an empty string. New documents are `Untitled`, `Untitled 2`, … by
probing existing folder names.

## Images

Written into **their own document's folder** and referenced by relative path
(`![alt](diagram.png)`). Never base64, never a shared top-level images folder — a
document folder has to stay self-contained and portable as a unit, and images then
travel with a rename for free. `writeImage` suffixes rather than overwriting when
the name is taken.

## Testing

`fs/documents.svelte.test.ts` runs against **OPFS**
(`navigator.storage.getDirectory()`) in the browser test project, which yields
real `FileSystemDirectoryHandle` objects. That makes the rename and save-ordering
tests genuine rather than assertions about a mock — keep it that way, and add a
case there before changing anything in `documents.ts`.
