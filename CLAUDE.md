# CLAUDE.md

This file defines the conventions, patterns, and architecture for this project.
Follow these guidelines precisely. Do not deviate without explicit instruction.

DyslexicWriter is a **fully local, single-user, distraction-free word processor** for a
dyslexic writer. There is no account, no server, no database and no sync. Documents are
real markdown files in a folder the user chooses on their own machine, read and written
directly through the **File System Access API**.

The bar for this project is **not losing the user's writing**. Every other concern is
secondary. A document is only ever as safe as the last successful write to disk, and the
filesystem — not any in-browser store — is the single source of truth. Favour
correctness and durability over cleverness.

**Scaling — not applicable, by design.** This app has no server tier to scale. It builds
to static files and runs entirely in one browser tab against one local folder. Any
proposal that reintroduces a server, an account, multi-device sync or collaborative
editing is out of scope and should be raised before it is built, not after.

---

## Skills Index — where the depth lives

This file is the **always-on core**: invariants, the data model, and cross-cutting
conventions. Each domain's full patterns, worked code examples, and workflows live in a
**project skill** under `.claude/skills/`. **Load the matching skill before doing
substantive work in its domain** — the General Rules below are the invariants, the skill
is the _how_.

| Skill                | Load when working on…                                                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project-structure`  | locating a file, where a module belongs, the full folder tree / route map                                                                                                                             |
| `filesystem-storage` | anything in `src/lib/fs/` — the folder picker, the directory handle, `config.json`, the folder scan, save/rename/delete ordering, image writes                                                        |
| `content-editor`     | the TipTap document editor — extension set, the toolbar's control cap, the markdown round-trip (`toMarkdown` / `fromMarkdown`)                                                                        |
| `content-tts`        | read-aloud / text-to-speech — `$lib/tts/*`, transport + voice-settings controls, exact sentence highlight (+ word highlight only where the engine emits `boundary` events), chirps, voice/speed prefs |
| `client-stores`      | anything in `src/lib/stores/` — the document store, autosave/debounce/flush lifecycle, the theme store                                                                                                |
| `models-validation`  | authoring/editing a `*.model.ts` Valibot schema                                                                                                                                                       |
| `i18n-messages`      | authoring Paraglide keys in `messages/en.json` — key naming + length-matched copy                                                                                                                     |
| `ui-components`      | building UI with shadcn-svelte, component props/variants                                                                                                                                              |
| `animations`         | any motion — Svelte transitions/motion/easing, shared `motion.ts` timings, the two-phase reveal pattern                                                                                               |
| `testing`            | writing Vitest tests; before committing changes to the markdown round-trip, the fs layer, or models                                                                                                   |
| `branch-and-commit`  | starting an approved plan (the branch is its first step), naming a branch, staging, or writing a commit message                                                                                       |

> When a domain skill contradicts a stale line here, the skill is the more detailed
> source — but hard invariants (the General Rules) always hold regardless of which skill
> is loaded.

---

## Project Goals for This Phase

- **Local-first documents** — a user-chosen working folder holding one folder per
  document, each containing a markdown file plus that document's own images
- **File System Access API** as the entire data layer — pick a folder, scan it, read,
  write, rename, delete; no server round-trips of any kind
- **Durable folder handle** — the `FileSystemDirectoryHandle` persisted through
  IndexedDB (it is not serializable to a string) and re-permissioned silently on return
  visits, so the user picks their folder once, not every launch
- **`config.json` as the only settings store** — theme, font, read-aloud voice/speed and
  the document index, all in one file in the user's folder so preferences travel with
  the writing
- **A lossless-enough markdown round-trip** — TipTap `JSONContent` is the editing model;
  markdown is what lands on disk and what is parsed back on open
- **Distraction-free editing** — a deliberately capped toolbar: headings, bold/italic,
  lists, blockquote, horizontal rule, tables, images. Nothing more.
- **Read aloud** — Web Speech API playback of the selection or whole document, with
  exact sentence highlighting, so the writer can catch by ear what the eye misses
- **Accessibility as the product** — OpenDyslexic as a first-class font choice, a warm
  light theme and a muted dark theme, generous reading measure
- **Word count + reading time** always visible, never intrusive
- **Honest browser support** — feature-detect the File System Access API and say plainly
  when a browser can't run the app, rather than degrading into something half-working

---

## Tech Stack

| Concern         | Choice                                       |
| --------------- | -------------------------------------------- |
| Framework       | SvelteKit (Svelte 5), `adapter-static` SPA   |
| Language        | TypeScript (strict mode)                     |
| Styling         | Tailwind v4                                  |
| Components      | shadcn-svelte                                |
| Rich text       | TipTap (`JSONContent` is the editing model)  |
| File storage    | File System Access API                       |
| Markdown ← JSON | turndown (+ GFM plugin for tables)           |
| Markdown → JSON | marked → TipTap `generateJSON`               |
| Folder handle   | Dexie (IndexedDB) — the handle, nothing else |
| Read aloud      | Web Speech API (`speechSynthesis`)           |
| Validation      | Valibot                                      |
| UI copy         | Paraglide-js (Inlang) — English only         |
| Theming         | mode-watcher (class strategy)                |
| Component dev   | Storybook                                    |
| Package manager | npm                                          |
| Testing         | Vitest                                       |
| OS              | Linux                                        |

> The full annotated folder tree and route map live in the **`project-structure`** skill.

---

## Data Model

There is **one** entity: a `document`. There is no schema, no migration, no server. The
model exists in two representations — in memory while editing, and on disk as files.

### In memory

```ts
interface Doc {
    title: string; // also the folder name and the file's basename
    contentJson: JSONContent; // TipTap — the editing source of truth
    wordCount: number; // derived live from TipTap's CharacterCount
    dirHandle: FileSystemDirectoryHandle | null; // null until first save
    fileHandle: FileSystemFileHandle | null; // null until first save
}
```

### On disk

The app **creates** one folder per document. It **finds** whatever is actually there —
a writer's existing folder has loose files at the root and chapters nested several
levels down, and all of it is theirs to open.

```
<working folder>/            <- chosen once via showDirectoryPicker()
├── config.json              <- ALL preferences + the document index
├── My Chapter/              <- a folder-document: what the app creates
│   ├── My Chapter.md        <- the document; markdown is what persists
│   └── diagram.png          <- images belong to the document that uses them
├── notes.md                 <- a file-document: found, not created
└── Book/
    └── Chapters/
        ├── One.md           <- also file-documents; they share the folder
        └── Two.md
```

That gives **two kinds of document**, and every filesystem operation branches on
which it is:

| Kind                | Is                                                        | Rename                                    | Delete                 | Images    |
| ------------------- | --------------------------------------------------------- | ----------------------------------------- | ---------------------- | --------- |
| **folder-document** | `X/X.md`, alone in its folder — the shape the app creates | moves the whole folder, inside its parent | removes it recursively | inside it |
| **file-document**   | a markdown file sitting among others, at any depth        | renames the file alone                    | removes only the file  | beside it |

`ownsFolder` is what separates them, and it is **recomputed by every scan**, never
trusted from the config cache. A folder only qualifies when it holds exactly that one
markdown file and no subdirectories — both conditions exist for delete, which is
recursive: a folder with anything else in it must never qualify, or deleting one
document takes its neighbours with it.

The scan walks **three directory levels** below the working folder. A directory the
cap stops at comes back unloaded and the Files screen shows it closed; expanding it
scans three more from there. An unbounded walk of somebody's whole Documents tree is
slow enough to read as broken. Dot-directories and `node_modules` are skipped.

### `config.json`

```ts
{
    version: number,
    theme: 'light' | 'dark',
    font: 'sans' | 'dyslexic',
    tts: { voiceUri: string | null, rate: number },
    documents: [{ title, folder, file, ownsFolder, lastModified }]
}
```

`folder` is a `/`-joined path relative to the working folder, and `''` is the working
folder itself — where a loose `notes.md` lives. `title` is the markdown file's
basename. `ownsFolder` is optional on read so an index written by an older version
still parses.

Validated with Valibot on read, **key by key**: a hand-edited mistake in one setting
costs the user that setting alone, not every other preference they have chosen. A
corrupt or unreadable file falls back to defaults rather than crashing the app.

The first-run value of every preference lives in `src/lib/config/defaults.json` —
`theme`, `font` and `tts` only. `version` and `documents` are structural rather than
configurable, so the code owns them. `defaults.json` is a checked-in seed, never
written to at runtime; it is validated through the same schemas and falls back to
in-code constants when malformed.

### Key rules

- **The filesystem is the source of truth.** `contentJson` is a working copy that exists
  only while a document is open. Nothing else caches document content — not IndexedDB,
  not `localStorage`, not `sessionStorage`.
- **The Files screen shows the folder structure**, not a flat list — a disclosure tree
  of the directories the scan reached. Sorting is folders first then documents,
  alphabetical; `lastModified` is shown per row but no longer orders anything.
- **A folder holding nothing but one document is shown as that document.** The scan
  lifts it into the parent rather than emitting a folder row you must open to find
  the single file named after it — `My Chapter/My Chapter.md` is one row, not two.
  The folder is untouched on disk and the entry's `folder` still points inside it,
  so rename, delete and images are unaffected. An unloaded folder is never
  collapsed: nothing is known about what else is in it.
- **A new document is in-memory only** until its first save. It starts as `Untitled`,
  incrementing to `Untitled 2`, `Untitled 3`… when a folder of that name already exists.
  Nothing is written to disk until there is something to write.
- **First save creates the folder, then the file inside it** — `My Chapter/My Chapter.md`.
  New documents are always created as a top-level folder-document, never into a
  subfolder.
- **Rename is folder first, then the file inside it**, so a failure halfway through can
  never leave a folder and file whose names disagree. A file-document renames only its
  file — its folder and any images beside it belong to the user, not to that document.
  Renaming is triggered on the title field's `change`/blur, debounced — **never** on
  every keystroke.
- **Images are written into the document's own directory** and referenced by relative
  path. Never base64, never a shared top-level images folder — a document folder must
  stay self-contained and portable as a unit. For a file-document that directory is the
  user's own folder, so the image lands beside the markdown that references it.
- **IndexedDB stores exactly one thing**: the `FileSystemDirectoryHandle`. It goes there
  because a handle is structured-cloneable but not string-serializable, so
  `localStorage` genuinely cannot hold it. Nothing else may be added to that store.
- **Every persisted preference lives in `config.json`** — no exceptions. If a new setting
  appears, it goes there too. Never reach for `localStorage`, IndexedDB or a URL param
  to remember a preference.
- The document index in `config.json` is a **cache for the Files screen**, not an
  authority. The folder on disk wins; a scan reconciles the index when they disagree.

---

## TypeScript

- Strict mode always — `"strict": true` in tsconfig.json
- No `any` — use `unknown` and narrow properly
- Explicit return types on all exported functions
- Types are inferred from Valibot schemas — never define types separately for validated data
- File System Access API types come from `@types/wicg-file-system-access` or an explicit
  local declaration — never `any`-cast a handle to get past the compiler

> Model/schema authoring detail is in the **`models-validation`** skill.

---

## Svelte 5 Conventions

Always use Svelte 5 runes. Never use Svelte 4 legacy syntax.

### State

```svelte
<!-- ✅ -->
let count = $state(0)

<!-- ❌ -->
let count = writable(0)
```

### Derived

```svelte
<!-- ✅ -->
let doubled = $derived(count * 2)

<!-- ❌ -->
$: doubled = count * 2
```

### Effects

```svelte
<!-- ✅ -->
$effect(() => {console.log(count)})

<!-- ❌ -->
$: console.log(count)
```

### Props

```svelte
<!-- ✅ -->
<script lang="ts">
    let { title, onSave }: { title: string; onSave: () => void } = $props();
</script>

<!-- ❌ -->
export let title: string
```

### Event handlers

```svelte
<!-- ✅ -->
<button onclick={handleClick}>Save</button>

<!-- ❌ -->
<button on:click={handleClick}>Save</button>
```

### Async/await in templates

Svelte 5 experimental async is enabled. Use `await` directly in component templates.
Wrap in `<svelte:boundary>` for loading and error states:

```svelte
<svelte:boundary>
    {#snippet failed(error)}
        <p>Failed to load: {error.message}</p>
    {/snippet}

    <p>{(await readConfig()).font}</p>
</svelte:boundary>
```

> **Svelte MCP server** — use it whenever writing or reviewing Svelte code:
> `list-sections` to discover docs, `get-documentation` to fetch relevant ones, and
> `svelte-autofixer` on any Svelte code you write (keep calling it until it returns no
> issues) before sending it to the user.

---

## Copy — Paraglide-js

All UI strings go through Paraglide. Never hardcode English strings in components — the
value here is not translation (the app ships **English only**) but keeping copy out of
the markup, in one place, editable without touching components.

```svelte
<script lang="ts">
    import * as m from '$lib/paraglide/messages';
</script>

<button>{m.document_save()}</button>
```

Messages live in `messages/en.json`. English is the only locale (`locales: ["en"]` in
`project.inlang/settings.json`); there is no locale switcher and no `fr.json`. After
adding message keys, recompile before type-checking:
`npx paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide`.

Keep copy short, calm and non-technical. The user is a writer, not an operator: say
"Couldn't save — check the folder is still available", not "EIO: write failed".

---

## Storage & Safety

These are **durability** concerns. The app holds the only copy of the user's work while
a document is open, so the failure modes that matter are all about losing writing.

- **Autosave is debounced, and flushed on every exit path.** A debounce alone is not
  enough — flush on blur, on `pagehide`, on `visibilitychange`, and on component
  destroy, so closing a tab mid-sentence cannot drop the last edit.
- **Never write a partially-derived document.** Derive the markdown first, then open the
  writable and write; if derivation throws, leave the existing file untouched.
- **Permission can be revoked at any time.** Every filesystem call must handle a
  rejected or stale handle by surfacing a re-pick prompt, never by silently failing or
  discarding the in-memory document.
- **Destructive operations confirm first.** Delete removes a real folder from the user's
  disk and there is no trash — confirm before it happens, and say what will be removed.
- **Validate everything read from disk.** `config.json` is user-editable and may be
  hand-edited, corrupt, or from a future version. Parse it through a Valibot schema and
  fall back to defaults; never trust its shape.
- **Treat file and folder names as untrusted.** Titles become path segments — reject or
  sanitise path separators, leading dots, reserved names and over-long names before they
  reach the filesystem.
- **Never render document content as raw HTML.** It goes through TipTap's sanitised
  render path. No `{@html}` on anything derived from a document or a filename.
- **Fail loudly to the user, quietly to the console.** A failed save must be visible in
  the UI — a silent failure is how writing gets lost.

---

## Environment Variables

None. The app is entirely local and requires no configuration to run.

If a build-time flag is ever genuinely needed it goes through `$env/static/public` and
must be documented in `.env.example` — but the default and correct answer is that this
project has no environment configuration.

---

## General Rules

> These are the always-on invariants. The worked examples behind each one live in the
> matching skill (see the Skills Index) — load it before doing the work, but never
> violate a rule here because a skill wasn't loaded.

- The **filesystem is the source of truth** for document content — never cache document
  content in IndexedDB, `localStorage` or `sessionStorage` "for convenience"
- The `FileSystemDirectoryHandle` lives **only** in IndexedDB, and it is the **only**
  thing in IndexedDB — never `localStorage` (a handle cannot be string-serialized)
- **Every persisted preference lives in `config.json`** — theme, font, TTS voice/speed,
  and anything added later. No exceptions, no other settings store
- Every preference in `config.json` has a sibling in `src/lib/config/defaults.json`
  giving its first-run value, and a new setting adds **both in the same commit** — the
  pairing `toMarkdown`/`fromMarkdown` already follows. `defaults.json` holds preferences
  only; `version` and `documents` stay owned by the code
- Renames establish the **new name first** and remove the **old one last**, whichever
  kind of document it is — Chromium's `move()` is not reliable for directories, and
  deleting last means a failure leaves a duplicate, never a loss. A folder-document
  copies its whole folder inside its own parent, the markdown file taking the new
  name; a file-document copies just the file. Triggered on `change`/blur — never per
  keystroke
- Images are written into **their own document's directory** and referenced by
  relative path — never base64, never a shared images folder
- Paths are `/`-joined and relative to the working folder, `''` being the working
  folder itself. `sanitiseTitle` owns each **segment** as it is created; a path is
  never parsed out of user input, and the resolver refuses `.` and `..` regardless
- `ownsFolder` is **recomputed by every scan**, never trusted from the config index —
  it decides whether delete removes a folder recursively or a single file
- New documents stay **in memory until first save**, named `Untitled`, `Untitled 2`, …
  by probing for an existing folder of that name
- Any node or mark added to the editor must be taught to **both** `toMarkdown` **and**
  `fromMarkdown` in the **same commit** — the two converters and the editor's extension
  list share one exported array and must never drift
- The markdown round-trip is covered by tests; a node that cannot survive the round-trip
  does not get added to the editor
- The toolbar is **capped by product decision**: headings, bold, italic, bullet/ordered
  list, blockquote, horizontal rule, table, image. No font-family or font-size pickers,
  no colour pickers, no alignment controls, no bubble/slash menus. Default to "no";
  when in doubt remove UI rather than add it
- Read-aloud highlighting is **ProseMirror decorations only**, never marks or nodes — it
  must never appear in `editor.getJSON()` and never reach the markdown
- SSR-guard every browser API (`showDirectoryPicker`, `speechSynthesis`, `AudioContext`,
  `window`, `indexedDB`) — the app is a static SPA but modules are still analysed
- Feature-detect the File System Access API at startup and show the unsupported screen
  rather than letting a non-Chromium browser fail deeper in
- Autosave debounces, but **always flush** on blur, `pagehide`, `visibilitychange` and
  destroy — a dropped last edit is the worst bug this app can have
- Confirm before any destructive filesystem operation; there is no undo for a deleted
  folder
- Validate anything read from disk with a schema from `src/lib/models/` — `config.json`
  is user-editable and must never be trusted by shape
- Sanitise titles before they become path segments (separators, dots, reserved names,
  length)
- No `any` — ever
- No `console.log` in committed code, except `console.error` for genuine,
  otherwise-invisible failures
- All UI copy goes through Paraglide (`m.*`) — never hardcode a string in a component,
  including error text. English is the only locale; recompile after adding keys
- shadcn-svelte for all UI components — do not hand-roll form inputs or buttons; add
  them via `npx shadcn-svelte@latest add <name> --yes` (writes into `src/lib/components/ui/`)
- All animation uses **native Svelte** (`svelte/transition` / `svelte/animate` /
  `svelte/motion` / `svelte/easing`) — never hand-rolled CSS transitions/keyframes/
  `cubic-bezier` for state-driven motion, never a third-party animation lib; shared
  durations/easing come from `$lib/config/motion.ts`
- Theme colours are **Tailwind CSS variables in `src/routes/layout.css`** — never
  hardcode a colour in a component. Light is warm sepia (never `#fff`); dark is muted
  (never `#000` with bright text)
- Fonts are **self-hosted** under `static/fonts/` — never load a webfont from a CDN
- Storybook stories live in `src/stories/` and mirror the `src/lib/components/` tree —
  never co-locate stories inside `src/lib/components/`
- Vitest suites live in `src/tests/` and mirror the `src/lib/` tree, importing their
  subject through `$lib/…` — never co-locate a test beside the module it tests. Shared
  harnesses go in `src/tests/support/`; the `.svelte.test.ts` suffix is what routes a
  suite to the browser project, so it must survive any move
- **Custom-submit forms** (an `onsubmit` handler rather than a native submit) must call
  `event.preventDefault()` — otherwise the browser does a full-page reload and the async
  handler never completes
- `speech.stop()` on editor unmount and on document switch — otherwise audio bleeds
  across documents and the highlight targets a destroyed view
- There is **no server**: no `.remote.ts` files, no `+page.server.ts`, no `hooks.server.ts`,
  no `$lib/server/`. `ssr = false` app-wide; the build is static
- Do not reintroduce accounts, sync, collaboration, or LLM features — all were
  deliberately cut. Raise it as a proposal before building, never as a side effect

---

## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: prettier, eslint, vitest, tailwindcss, paraglide, mcp, storybook, sveltekit-adapter (static)
