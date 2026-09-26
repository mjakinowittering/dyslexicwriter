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

## Principles

They apply to code and to guidance (this file, the skills, the README) alike.

- **Keep it simple** — the plainest thing that works; no cleverness to save a line.
- **You aren't gonna need it** — build for today's requirement, not a guessed one; no
  speculative options, abstractions or documentation of what the code already shows.
- **Don't repeat yourself** — one home per rule, fact or helper; elsewhere, point to
  it. A rule applying everywhere lives here; a domain rule lives in its skill.
- **Kaizen** — leave it a little better: fix what's stale or wrong in whatever you
  touch, in small steps, rather than saving it for a rewrite.

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
| `branch-and-commit`  | starting an approved plan (the branch is its first step), naming a branch, staging, writing a commit message, pushing a branch, or opening a PR — which always targets `develop`                      |
| `todo-review`        | the `## Todo` section of `README.md` — showing the list, planning an item, adding one, pruning stale ones                                                                                             |
| `ascii-wireframes`   | drawing any change a writer will see, before it is built, and sequence diagrams for a flow crossing the editor, the stores and the filesystem                                                         |

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
- **`config.json` as the only settings store** — theme, font, invisible characters,
  read-aloud voice/speed and the markdown formatting options, all in one file in the
  user's folder so preferences travel with the writing. Settings only: the list of
  documents is scanned from the folder, never cached here
- **A lossless-enough markdown round-trip** — TipTap `JSONContent` is the editing model;
  markdown is what lands on disk and what is parsed back on open
- **Distraction-free editing** — a deliberately capped toolbar: headings, bold/italic,
  lists, checklists, blockquote, horizontal rule, tables, images, links. Nothing more.
- **Read aloud** — Web Speech API playback of the selection or whole document, with
  exact sentence highlighting, so the writer can catch by ear what the eye misses
- **Accessibility as the product** — OpenDyslexic as a first-class font choice, a
  warm cream light theme and a neutral dark theme, generous reading measure
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
| JSON → Markdown | turndown (+ GFM plugin for tables)           |
| Markdown → JSON | marked → TipTap `generateJSON`               |
| Markdown format | Prettier standalone, in a web worker         |
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
// The open document, held by the document store (src/lib/stores/document.svelte.ts)
{
    title: string; // the markdown file's basename
    contentJson: JSONContent | null; // TipTap — the editing source of truth
    wordCount: number; // derived live from TipTap's CharacterCount
    location: DocumentLocation | null; // null until first save — see below
    saveState: SaveState; // idle | pending | saving | saved | error
    savedAt: number | null; // epoch ms of the last successful write
}
```

A document is held as a **path**, never as handles. `DocumentLocation` is
`{ folder, file, ownsFolder }`, and every filesystem call resolves it against the
working folder's handle at the moment it runs — a handle cached across an await is
one a rename or an outside edit can invalidate. `null` is the test for "not saved
yet", never falsiness: `''` is a real folder, the working folder itself.

The Files screen's list is the other in-memory representation — a `FolderNode` tree of
`DocumentIndexEntry` rows, scanned from the folder into the workspace store and held
nowhere else:

```ts
interface DocumentIndexEntry {
    title: string; // the markdown file's basename
    folder: string; // '/'-joined, relative to the working folder; '' is the root
    file: string; // file name within that folder, .md included
    ownsFolder: boolean; // folder-document or file-document — see below
    lastModified: number; // epoch ms, shown against the row
    size: number; // bytes, from the same File as lastModified
}
```

A plain interface rather than a Valibot schema: every entry is built by `scanFolder` from
a real file handle, so there is no untrusted input to validate.

### On disk

The app **creates** one folder per document. It **finds** whatever is actually there —
a writer's existing folder has loose files at the root and chapters nested several
levels down, and all of it is theirs to open.

```
<working folder>/            <- chosen once via showDirectoryPicker()
├── config.json              <- ALL preferences, and nothing else
├── .trash/                  <- deleted documents; skipped by the scan
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

| Kind                | Is                                                             | Rename                                    | Delete                                | Images    |
| ------------------- | -------------------------------------------------------------- | ----------------------------------------- | ------------------------------------- | --------- |
| **folder-document** | `X/X.md`, alone in its folder — every document the app creates | moves the whole folder, inside its parent | moves the whole folder into `.trash/` | inside it |
| **file-document**   | a markdown file sitting among others, at any depth             | renames the file alone                    | moves only the file into `.trash/`    | beside it |

`ownsFolder` is what separates them: the folder is named after the file and holds
exactly that one markdown file and no subdirectories. The Files screen shows the folder
structure as a disclosure tree, three levels deep at a time, with a folder-document
lifted into its parent as one row. The scan, the collapse and the trash are detailed in
the **`filesystem-storage`** skill.

### `config.json`

```ts
{
    version: number,
    theme: 'light' | 'dark',
    font: 'sans' | 'dyslexic',
    showInvisibles: boolean,
    tts: { voiceUri: string | null, rate: number },
    prettier: { printWidth: number, proseWrap: 'always' | 'never' | 'preserve' }
}
```

**Preferences only** — the document list is scanned, never stored here. Parsed key by
key so one bad hand-edit costs only that setting, and brought up to date on adopt.
The parse is in **`models-validation`**; the adopt rewrite in **`filesystem-storage`**.

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

## Svelte 5

Runes only (`$state`, `$derived`, `$effect`, `$props`, `onclick`) — never Svelte 4
syntax (`writable`, `$:`, `export let`, `on:click`). Experimental async is enabled:
`await` directly in templates, inside a `<svelte:boundary>` with a `failed` snippet.

> **Svelte MCP server** — use it whenever writing or reviewing Svelte code:
> `list-sections` to discover docs, `get-documentation` to fetch relevant ones, and
> `svelte-autofixer` on any Svelte code you write (keep calling it until it returns no
> issues) before sending it to the user.

---

## Environment Variables

None that the app reads. The only one in the repo is **`BASE_PATH`**, build tooling
read by `svelte.config.js` to set `kit.paths.base`, supplied by the deploy workflow
and unset everywhere else. A flag the app itself genuinely needs goes through
`$env/static/public` and `.env.example` — but the default answer is none.

---

## General Rules

> These are the always-on invariants. The worked examples behind each one live in the
> matching skill (see the Skills Index) — load it before doing the work, but never
> violate a rule here because a skill wasn't loaded.

- The **filesystem is the source of truth** for document content — never cache document
  content in IndexedDB, `localStorage` or `sessionStorage` "for convenience"
- The `FileSystemDirectoryHandle` lives **only** in IndexedDB, and it is the **only**
  thing in IndexedDB — never `localStorage` (a handle cannot be string-serialized)
- **Every persisted preference lives in `config.json`** — theme, font,
  `showInvisibles`, TTS voice/speed, the Prettier options, and anything added later.
  No exceptions, no other settings store
- Every preference in `config.json` has a sibling in `src/lib/config/defaults.json`
  giving its first-run value, and a new setting adds **both in the same commit** — the
  pairing `toMarkdown`/`fromMarkdown` already follows. `defaults.json` holds preferences
  only; `version` is structural and stays owned by the code
- Renames establish the **new name first** and remove the **old one last** — a failure
  leaves a duplicate, never a loss. Triggered on `change`/blur — never per keystroke
- Images are written into **their own document's directory** and referenced by
  relative path — never base64, never a shared images folder
- Paths are `/`-joined and relative to the working folder, `''` being the working
  folder itself. `sanitiseTitle` owns each **segment** as it is created; a path is
  never parsed out of user input, and the resolver refuses `.` and `..` regardless
- `ownsFolder` is **recomputed by every scan**, never remembered, and **re-derived from
  the directory** immediately before rename's or delete's destructive step. Where it no
  longer holds, rename renames the markdown file alone and delete refuses
- **Every document the app creates is a folder-document.** From the editor it stays
  **in memory until first save**, as `Untitled`, `Untitled 2`, …, landing at the top
  level; from a Files screen folder row it is named first and written at once, as
  `<folder>/<Title>/<Title>.md`. A clashing name is refused **before** the write,
  never worked around afterwards
- A constant, type or function with a home already **is imported from it**, never
  retyped. The empty document shape (`emptyDocument()`), `UNTITLED`, the TTS rate
  bounds, the theme grounds in `layout.css`, a format control's `value` — each has
  exactly one definition, and a second copy is a divergence waiting for the next
  edit rather than a convenience
- Any node or mark added to the editor must be taught to **both** `toMarkdown` **and**
  `fromMarkdown` in the **same commit** — the two converters and the editor's extension
  list share one exported array and must never drift
- The markdown round-trip is covered by tests; a node that cannot survive the round-trip
  does not get added to the editor
- Markdown is **formatted with Prettier on its way to disk**, between `toMarkdown` and
  `joinFrontmatter` — the body only, so Prettier's YAML printer never touches the
  frontmatter fence. `writeDocument` receives the formatter as a parameter; `fs/` must
  stay free of any Prettier or worker import. A rename copies bytes and never
  reformats
- **Never write a partially-derived document** — derive and format the markdown fully
  before opening the writable, which truncates. Formatting must **never fail a save**:
  every formatter failure resolves with the unformatted markdown
- Formatting changes the bytes on purpose but must never change the **document** —
  hard wrapping is covered by round-trip tests that pin the hazard of a `1.`, `-`, `#`,
  `>` or `+` landing at a line start
- The toolbar is **capped by product decision**: undo/redo, headings, bold, italic,
  bullet/ordered/task list, blockquote, horizontal rule, table, image, link. No
  font-family or font-size pickers, no colour pickers, no alignment controls, no
  bubble/slash menus. The link card shown when a link is clicked is not a bubble menu —
  it holds no formatting, only where the link goes, Edit and Open. Nor is the title row's
  folder button and its "Saved in" card: they show where the document is saved, with
  Show in Files, and format nothing. Default to "no"; when in doubt remove UI rather
  than add it
- Read-aloud highlighting and the invisible-character markers are **ProseMirror
  decorations only**, never marks or nodes — they must never appear in
  `editor.getJSON()` and never reach the markdown
- SSR-guard every browser API (`showDirectoryPicker`, `speechSynthesis`, `AudioContext`,
  `window`, `indexedDB`) — the app is a static SPA but modules are still analysed
- Feature-detect the File System Access API at startup and show the unsupported screen
  rather than letting a non-Chromium browser fail deeper in
- Autosave debounces, but **always flush** on blur, `pagehide`, `visibilitychange` and
  destroy — a dropped last edit is the worst bug this app can have
- Permission can be revoked at any time: a rejected or stale handle surfaces a
  re-pick prompt, never a silent failure or a discarded in-memory document
- **Fail loudly to the user** — a failed save is always visible in the UI
- Confirm before any destructive filesystem operation — a delete included, even though
  it only moves the document into `.trash/`
- **Delete is a move into `.trash/`**, never a `removeEntry` of the document itself —
  copy in first, remove the original last, under a timestamped name. Only an empty
  folder is removed outright
- Validate anything read from disk with a schema from `src/lib/models/` — `config.json`
  is user-editable and must never be trusted by shape
- Sanitise titles before they become path segments (separators, dots, reserved names,
  length)
- Never render document content or a filename as raw HTML — no `{@html}`
- No `any` — ever
- No `console.log` in committed code, except `console.error` for genuine,
  otherwise-invisible failures
- All UI copy goes through Paraglide (`m.*`) — never hardcode a string in a component,
  including error text. English is the only locale; recompile after adding keys.
  Copy is short, calm and non-technical: "Couldn't save — check the folder is still
  available", never "EIO: write failed"
- shadcn-svelte for all UI components — do not hand-roll form inputs or buttons; add
  them via `npx shadcn-svelte@latest add <name> --yes` (writes into `src/lib/components/ui/`)
- All animation uses **native Svelte** (`svelte/transition` / `svelte/animate` /
  `svelte/motion` / `svelte/easing`) — never hand-rolled CSS transitions/keyframes/
  `cubic-bezier` for state-driven motion, never a third-party animation lib; shared
  durations/easing come from `$lib/config/motion.ts`
- Theme colours are **Tailwind CSS variables in `src/routes/layout.css`** — never
  hardcode a colour in a component. Light is a **warm cream**, never `#fff`: every
  surface faintly tinted at one hue, with near-black ink leaning the same way, on
  the dyslexia guidance argued in `layout.css`. Dark is shadcn-svelte's neutral dark,
  near-black with near-white ink, every surface chroma `0`. Colour is kept for
  signals, each argued beside it in `layout.css`, and sanctioned only there:
    - **`--destructive`**: stays red in both themes; a grey delete confirmation
      says nothing
    - **`--reveal`** / **`--reveal-ring`**: a highlighter pen for "look here" and for
      text selection
    - **`--marker`**: list bullets, numbers, the checkbox tick and the line through
      a finished to-do, at text contrast
    - **`--rule-warm`**: the quote rule, the table header rule and the invisible
      characters, at the non-text 3:1
    - **`--link`**: the one cool hue, so a link differs from body text by more
      than its underline
    - **`--code-chip`** / **`--code-ink`**: inline code; the chip drops to
      chroma `0` in dark, like every other surface

    The read-aloud tints are the one exception outside `layout.css`: functional
    colour, in `PageEditor.svelte`, with dark ink forced over them in both themes.
    Any new chromatic token needs the same kind of argument

- Fonts are **self-hosted** — never load a webfont from a CDN. Both come from their
  `@fontsource` packages and are `@import`ed in `layout.css`, so Vite bundles the files
  out of `node_modules` and their licence notices travel with the build. There is no
  `static/fonts/`
- Storybook stories live in `src/stories/` and mirror the `src/lib/components/` tree —
  never co-locate stories inside `src/lib/components/`
- Vitest suites live in `src/tests/` and mirror the `src/lib/` tree, importing their
  subject through `$lib/…` — never co-locate a test beside the module it tests. Shared
  harnesses go in `src/tests/support/`; the `.svelte.test.ts` suffix is what routes a
  suite to the browser project, so it must survive any move
- **Custom-submit forms** (an `onsubmit` handler rather than a native submit) must call
  `event.preventDefault()` — otherwise the browser does a full-page reload and the async
  handler never completes
- `speech.stop()` on editor unmount, on document switch **and on `pagehide`** —
  otherwise audio bleeds across documents and the highlight targets a destroyed view.
  `pagehide` is the one `onDestroy` cannot cover: it does not run on a tab close or
  reload, and Chrome's speech queue outlives the page that started it
- There is **no server**: no `.remote.ts` files, no `+page.server.ts`, no `hooks.server.ts`,
  no `$lib/server/`. `ssr = false` app-wide; the build is static
- Do not reintroduce accounts, sync, collaboration, or LLM features — all were
  deliberately cut. Raise it as a proposal before building, never as a side effect

---

## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: prettier, eslint, vitest, tailwindcss, paraglide, mcp, storybook, sveltekit-adapter (static)
