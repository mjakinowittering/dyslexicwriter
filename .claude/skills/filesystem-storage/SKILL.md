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
| `stores/workspace.svelte.ts` | The chosen folder, the parsed config, the document tree, and the `WorkspaceStatus` machine                             |
| `stores/document.svelte.ts`  | The open document: autosave debounce, flush, rename, image insert                                                      |

## On-disk shape

The app **creates** one folder per document. It **finds** whatever is there.

```
<working folder>/
├── config.json              <- ALL preferences + the document index
├── My Chapter/              <- a folder-document: what the app creates
│   ├── My Chapter.md        <- the document
│   └── diagram.png          <- images belong to the document that uses them
├── notes.md                 <- a file-document: found, not created
└── Book/
    └── Chapters/
        ├── One.md           <- also file-documents; they share the folder
        └── Two.md
```

## Two kinds of document

Every operation in `documents.ts` branches on `location.ownsFolder`:

- **folder-document** — `X/X.md`, alone in its folder. Rename copies the whole
  folder inside its own **parent** and removes the source last; delete removes it
  recursively; images go inside it.
- **file-document** — a markdown file among others, at any depth. Rename renames
  only the file (new file first, old one last — same guarantee); delete removes
  only that file; images land beside it, in the user's own folder.

`ownsItsFolder()` requires the folder to be named after the file **and** to hold
exactly that one markdown file **and** no subdirectories. The last two conditions
exist for delete, which is recursive — a folder with anything else in it must never
qualify, or deleting one document takes its neighbours with it. It is recomputed by
every scan and never trusted from the config cache.

## Paths

A document's `folder` is a `/`-joined path relative to the working folder, and `''`
is the working folder itself. `resolveDirectory()` walks it to a handle and refuses
`.` and `..` — paths are assembled from segments `sanitiseTitle` already owns and
are never parsed out of user input, but a path that escapes the working folder is
the one mistake with no recovery. Helpers (`joinPath`, `parentPath`, `lastSegment`,
`documentPath`, `titleFromFileName`) live in `models/document.model.ts`.

## The scan is depth-limited and lazy

`scanFolder(root, { path, depth })` returns a `FolderNode` tree and walks
`SCAN_DEPTH` (3) directory levels. A directory the cap stops at comes back
`loaded: false`; the Files screen shows it closed, and `workspace.toggle()` scans
three more levels from there when the user opens it. An unbounded walk of somebody's
whole Documents tree stats every markdown file in it — slow enough to read as broken.
Dot-entries and `node_modules` are skipped; `config.json` falls out of the `.md`
filter.

A folder whose entire contents is one markdown file is **collapsed into its
parent**: the walk lifts that document up and emits no folder row, so the shape the
app creates for itself (`My Chapter/My Chapter.md`) reads as one row rather than a
disclosure repeating the same name inside itself. It cascades — `Book/Chapters/One.md`
with nothing else in either folder surfaces `One` at the root. Only the tree changes;
the entry's `folder` still names the real directory, so `ownsFolder`, rename, delete
and image writes all behave exactly as before. An unloaded folder is never collapsed.
That also means a document's row is not necessarily under `findFolder(entry.folder)`,
which is why `findDocument()` searches the tree level by level.

`workspace.refresh()` re-walks from the root and replays the folders the user had
opened past the cap, so a rescan never folds the tree back up. Autosave calls
`workspace.touch(entry)` instead — a full re-walk on a 600ms debounce is far too
much work, so `touch` moves one entry's mtime and only falls back to `refresh()`
when the document is one the tree has never seen (a first save).

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

### Rename: new name first, old name LAST

Chromium's `FileSystemHandle.move()` is reliable for files but **not for
directories**, so a folder-document rename is a copy followed by a delete, run
inside the folder's own parent:

1. create the destination folder
2. copy every file across, the markdown file taking the new name as it goes
3. only then `removeEntry` the source, recursively

A file-document does the same thing one level down: write the new file, then
remove the old one. Deleting last is what makes either safe — a failure at any
point leaves the original intact. The worst case is a duplicate, never a lost
document. Renaming fires on the title field's `change`/blur — **never** per
keystroke.

### Confirm before deleting

`deleteDocument` removes something real from the user's disk and there is no
trash. Always confirm, and be honest about which it is: a folder-document takes
its folder and images with it, a file-document takes only itself. That is two
different confirmation strings, not one.

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
never returns an empty string. It owns one **segment** at a time — the path around
it is the app's, not the user's. New documents are `Untitled`, `Untitled 2`, … by
probing top-level folder names, and are always created as a folder-document at the
root; the app never creates a document into a subfolder.

## Images

Written into **their own document's directory** and referenced by relative path
(`![alt](diagram.png)`). Never base64, never a shared top-level images folder — a
document folder has to stay self-contained and portable as a unit, and images then
travel with a rename for free. `writeImage` suffixes rather than overwriting when
the name is taken.

For a file-document that directory is the user's own folder, so the image lands
beside the markdown that references it. That is what "beside it" has to mean when
there is no folder belonging to that document alone — inventing one behind the
user's back would be worse.

## Testing

`fs/documents.svelte.test.ts` runs against **OPFS**
(`navigator.storage.getDirectory()`) in the browser test project, which yields
real `FileSystemDirectoryHandle` objects. That makes the rename and save-ordering
tests genuine rather than assertions about a mock — keep it that way, and add a
case there before changing anything in `documents.ts`.
