# DyslexicWriter

A fully local, single-user, distraction-free word processor built for a dyslexic writer.

There is no login, no server, no database and no cloud sync. Your documents are real
markdown files in a folder you choose on your own machine, opened and written directly
through the browser's **File System Access API**. That means your writing stays
portable, backup-able, and readable in any other editor — DyslexicWriter is just a nice
way to work on it, not a place it gets locked up.

- **Write without friction** — a minimal toolbar (headings, basic marks, lists, tables,
  images) and nothing else. No font-family pickers, no font-size dropdowns, no clutter
  competing with the words.
- **Read aloud** — the whole document or just what you've selected is spoken back to
  you, with the current sentence highlighted as it goes, so you can catch by ear the
  mistakes your eye slides past. Transport controls for play/pause, stop, and skipping
  a sentence back or forward. Voice and speed are yours to set.
- **A plain Files screen** — list your documents, create, open, rename, delete.
- **Word count and reading time** — always visible in the status bar, never in the way.
- **Two typefaces** — a standard sans-serif, or OpenDyslexic.
- **Two themes** — a warm light/sepia (not stark white) and a soft muted dark (not
  bright-on-black).

## How your documents are stored

You pick one working folder the first time you open the app. Inside it:

```
my-writing/                  <- the folder you chose
├── config.json              <- all your preferences + the document index
├── My Chapter/
│   ├── My Chapter.md        <- the document itself
│   └── diagram.png          <- images live beside the document that uses them
└── Another Draft/
    └── Another Draft.md
```

Each document is a folder containing a markdown file of the same name, plus any images
you've dropped in. Images are written as real files and referenced with relative paths
(`![alt](diagram.png)`) — never embedded as base64 — so a document folder is
self-contained and can be moved, zipped or shared as a unit.

`config.json` holds **every** preference (theme, font, read-aloud voice and speed) as
well as the document index. Because it lives in your folder rather than in browser
storage, moving that folder to another machine or browser brings your settings and your
Files screen with it.

The browser's IndexedDB is used for exactly one thing: remembering the handle to your
chosen folder so you don't have to re-pick it on every visit. No document content and
no settings are ever stored there.

## Browser support

DyslexicWriter needs the File System Access API, which today means **Chrome or Edge**
(or another Chromium-based browser). Firefox and Safari don't implement it; opening the
app in those browsers shows a short message saying so rather than half-working.

## Tech Stack

| Concern         | Choice                                       |
| --------------- | -------------------------------------------- |
| Framework       | SvelteKit (Svelte 5), static SPA             |
| Language        | TypeScript (strict mode)                     |
| Styling         | Tailwind v4                                  |
| Components      | shadcn-svelte                                |
| Rich text       | TipTap (`JSONContent` is the editing model)  |
| File storage    | File System Access API                       |
| JSON → Markdown | turndown (+ GFM plugin for tables)           |
| Markdown → JSON | marked → TipTap `generateJSON`               |
| Folder handle   | Dexie (IndexedDB) — the handle, nothing else |
| Read aloud      | Web Speech API (`speechSynthesis`)           |
| Validation      | Valibot                                      |
| UI copy         | Paraglide-js (Inlang) — English only         |
| Theming         | mode-watcher (class strategy)                |
| Component dev   | Storybook                                    |
| Testing         | Vitest                                       |

## Setup

```sh
npm install
```

That's it. There is no `.env`, no database to migrate and no services to configure —
the app is entirely local.

## Development

```sh
npm run dev
npm run dev -- --open   # open browser automatically
```

## Testing

```sh
npm test                # run unit tests once
npm run test:unit       # run in watch mode
```

## Linting & Formatting

```sh
npm run lint            # check formatting + eslint
npm run format          # auto-format with prettier
npm run check           # svelte-check type checking
npm run check:watch     # type checking in watch mode
```

## Storybook

```sh
npm run storybook       # start Storybook dev server on port 6006
npm run build-storybook # build static Storybook
```

## Production Build

```sh
npm run build           # static output in build/
npm run preview         # preview the production build locally
```

The build is a plain folder of static files — serve it from anywhere, or open it
locally. There is no server process.

## Todo

- [ ] Read-aloud: karaoke-style auto-scroll to keep the spoken word in view as playback
      advances (the sentence highlight is in place; scrolling to follow it is not)
- [ ] Fix the empty read-aloud voice picker — `SpeechController.loadVoices()`
      (`speech-controller.svelte.ts:98`) is never called from anywhere, so `speech.voices`
      stays empty and the picker always shows its no-voices state. Call it on editor mount
      (and remove the `voiceschanged` listener on teardown)
- [ ] Add support for Apple Mac keyboard shortcuts in toolbar tooltips — map `Ctrl`→`⌘`,
      `Alt`→`⌥` based on platform (currently hardcoded to `Ctrl`/`Alt`)
- [ ] Make inserted images actually display — insertion is already a proper TipTap image
      node (`setImage` in `FormatInsertImage.svelte`), but its `src` is a path relative to
      the document folder (`diagram.png`), which the browser resolves against the app URL
      and fails to load, so only the alt text shows. Resolve each image's `src` to a
      `blob:` URL from its file handle at render time, revoke on unmount/document switch,
      and keep the relative path in the JSON so the markdown round-trip is unaffected
- [ ] Style tables in the editor — an inserted table is effectively invisible. No plugin
      is missing (`@tiptap/extension-table` is installed and configured); TipTap ships
      headless, and there is currently no table CSS at all. Tailwind Typography's `prose`
      gives padding and a header rule but deliberately draws no cell borders, so an empty
      grid has nothing to see. Add cell borders, a header-cell background and sensible
      `min-width` in `layout.css`, plus the ProseMirror table internals — `.tableWrapper`
      (horizontal overflow) and `.selectedCell` (cell-selection tint). Column resizing is
      off by design, so `.column-resize-handle` is not needed
- [ ] Improve the welcome / first-run experience — replace the single "choose folder"
      button with two large graphical cards, both of which open the directory picker: - **Suggested** — ends up at `Documents/DyslexicWriter`. The picker cannot be pointed
      at a path, so this opens with `startIn: 'documents'` and then creates the folder
      inside whatever the user picks, via `getDirectoryHandle('DyslexicWriter',
{ create: true })`. Say plainly on the card where the writing will end up - **Choose your own** — the same picker, no subfolder created. It cannot start at the
      home directory: Chromium refuses the home folder, Downloads and system directories
      outright (see the existing `welcome_folder_hint` copy), so start at Documents or
      Desktop - Returning visits already work — `workspace.restore()` reads the stored handle from
      IndexedDB (a directory handle has no string form, so it can never be localStorage)
      and falls back to the welcome screen. What's missing is the middle case: when
      `queryPermission` is not yet `granted`, restore drops silently to first-run. Instead
      remember the folder's name and offer a "Reopen <name>" card, which supplies the user
      gesture `requestPermission` needs. Chromium's "allow on every visit" grant makes
      this silent thereafter
- [ ] Consider a simple local version history for documents (deliberately not built in
      the initial fork — flagged as a future idea, not a commitment)
- [ ] Deploy to GitHub Pages as a static SPA, and add the site-level SEO /
      OpenGraph metadata that goes with it. The build shape is already right —
      `adapter-static` is configured (`svelte.config.js:17`) and the app is
      client-only (`ssr = false`, `prerender = false`, `+layout.ts`). What is
      missing is everything Pages specifically needs, plus every meta tag beyond
      `charset` / `viewport` / `text-scale` (`src/app.html`). SSR is not the answer
      and is not coming back: with no server tier the tags are static in
      `app.html`, which the SPA fallback then serves on every route.
    - **`fallback: 'index.html'` breaks deep links on Pages.** Pages has no SPA
      rewrite — it serves `404.html` for any path that is not a real file, so
      reloading `/edit` would 404. Change the fallback to `404.html`, which makes
      Pages hand the SPA to every unknown path
    - **Add `static/.nojekyll`.** Pages runs Jekyll by default, which strips
      directories beginning with an underscore — that is SvelteKit's entire
      `_app/` bundle. Without the file the deployed site loads nothing
    - **The base path is `/dyslexicwriter`.** This is settled: the repo is now
      `mjakinowittering/dyslexicwriter` and `package.json` already declares the
      matching `homepage`. A project site serves from
      `https://<user>.github.io/<repo>/`, so `kit.paths.base` has to be set and
      every asset URL routed through it — a user site or a custom domain would
      serve from `/` and need none of it. CLAUDE.md rules out environment
      configuration, so the base belongs in `svelte.config.js` as a literal, not
      a build flag
    - **There is no `.github/workflows/` at all** — add a deploy job on `master`
      using `actions/upload-pages-artifact` + `actions/deploy-pages` over `build/`
    - **The metadata is site-level, not per-route.** The public surface is one
      screen, the welcome page; `/edit` only ever shows the user's own local
      documents, so there is nothing per-document to describe and no dynamic
      OpenGraph to generate. Put `description`, `og:*`, `twitter:*`, `theme-color`
      and a canonical URL directly in `app.html`, and add a static preview image
      under `static/` — the favicon is a bundled asset
      (`$lib/assets/favicon.svg`, content-hashed at build) and cannot serve as an
      `og:image`, which needs a stable absolute URL. These tags sit outside the
      Svelte tree, so they stay literal rather than going through Paraglide
    - **Know the limit of a JS-only shell.** With `ssr = false` the served HTML
      body is empty. Google executes JS and will see the app, but many crawlers
      and LLM fetchers do not and read the head alone. If that matters, the fix is
      a little real prose in `app.html` — a `<noscript>` block describing the app —
      not reinstating SSR
    - `static/robots.txt` already allows everything. A `sitemap.xml` is only worth
      adding once the base path decision produces a stable public URL
- [ ] Show the Files screen as a folder tree rather than a flat list, and stop
      assuming every document is a top-level folder of its own. `scanFolder`
      (`src/lib/fs/documents.ts:54`) walks the working folder exactly one level
      deep and skips anything that is not a directory, so the only shape it can
      find is `<folder>/<name>.md`; `+page.svelte:152` then renders what it
      found as a flat `<ul>` sorted by `lastModified`. A loose `notes.md` at the
      root, or a chapter nested two levels down, is invisible — point the app at
      an existing writing folder and it can look empty. The scan should walk the
      tree, take every file ending in `MARKDOWN_EXTENSION` wherever it sits, and
      the screen should show the directory structure it came from.
    - **The scan.** Recurse from the root, keep every `.md`, skip
      `config.json`. Settle a depth cap and whether dot-directories are skipped
      — an unbounded walk of a folder the user pointed at their whole Documents
      tree is slow enough to feel broken. `findMarkdownFile`
      (`documents.ts:36`) already tolerates a markdown file whose name differs
      from its folder, so that half of "not a singleton directory" is done
    - **`DocumentIndexEntry.folder` stops being a single segment.** It is one
      today everywhere it is used: the `{#each}` key, the `?doc=` route param
      (`+page.svelte:38`), and the value handed straight to
      `getDirectoryHandle` by `readDocument`, `writeDocument`,
      `renameDocument`, `deleteDocument` and `writeImage`. A nested document
      needs a path — segments or a `/`-joined string — plus one resolver that
      walks it to a handle, and `documentIndexEntrySchema`
      (`config.model.ts:37`) widened to match. `sanitiseTitle` still owns each
      segment individually; the path itself is never user input and must never
      be built from one
    - **A root-level `.md` has no folder to own.** Rename copies a whole folder
      and removes the old one last, and `writeImage` writes into the document's
      folder — neither is meaningful for a loose file sitting beside the user's
      other files. Decide per case (rename the file alone; write images beside
      it) rather than inventing a folder behind the user's back, and keep the
      delete confirmation honest about whether a file or a folder goes
    - **This changes the documented data model**, so CLAUDE.md's "On disk"
      shape and the one-folder-per-document rules move in the same commit —
      raise the widened model before building it, not after
    - **The tree UI itself.** shadcn-svelte's `collapsible` is not installed
      (`src/lib/components/ui/`), expand/collapse motion is native Svelte with
      timings from `$lib/config/motion.ts`, and the rows need real tree
      semantics rather than nested `<ul>`s styled to look indented. The current
      list carries rename and delete buttons per row, which have to survive the
      move. Sorting by `lastModified` is a flat-list idea and mostly stops
      making sense here
    - Scope: the Files screen and the scan. Not a sidebar file tree inside the
      editor, not creating documents into a chosen subfolder, and not moving
      documents between folders — all follow more easily once the path work
      above exists
- [ ] Preserve YAML frontmatter instead of silently destroying it. `fromMarkdown`
      hands the raw file straight to marked (`from-markdown.ts:30`), which has no
      frontmatter support: an opening `---` parses as a thematic break, the lines
      under it as a paragraph, and the closing `---` as a setext underline for
      that paragraph. A file opening with a `---` fence around `title:`,
      `author:` and `tags:` lines therefore becomes an `<hr>` plus an `<h2>`,
      and the first autosave writes it back as `* * *` followed by
      `## title: My Chapter author: Matthew tags: \[draft\]` — delimiters gone,
      the line breaks collapsed into one heading, the brackets escaped, and the
      metadata now sitting in the prose for the writer to delete. Nothing warns
      and there is no undo. Split the file on read, hold the frontmatter on the
      document store beside the JSON, and reunite the two on write.
    - **Use `gray-matter`.** `matter(raw)` returns `data` (the frontmatter as an
      object) and `content` (the body markdown); `matter.stringify` takes the
      two back to a file — one dependency closing the loop in both
      directions. `front-matter` only reads and has no `stringify`;
      `vfile-matter` needs the vfile object model; `yaml` v2 knows nothing about
      markdown fences. Accepted trade-off: comments in the frontmatter are
      dropped and quoting style is normalised on write-back. If the 2020 publish
      date and its unmaintained js-yaml v3 dependency prove a problem, the swap
      is `yaml` v2 plus a small local fence split — same design, one more file
      to own
    - **Two settings to get right.** js-yaml coerces `date: 2026-08-14` into a
      JS `Date` and writes it back as `2026-08-14T00:00:00.000Z`, which is a
      semantic change to the user's file rather than a cosmetic one — pass
      js-yaml's `JSON_SCHEMA` through gray-matter's `engines` option to keep
      scalars as written. It also throws on malformed YAML, and that is the
      document-open path: catch it and fall back to treating the file as all
      body, so a typo in someone's YAML can never make a document unopenable
    - **Where it threads through.** `readDocument` reads the file's text
      (`documents.ts:120`); split there and add the result to `OpenedDocument`
      (`documents.ts:97`). It needs a home on the document store beside
      `contentJson` (`document.svelte.ts:30`) as a `$state` holding a
      `Record<string, unknown>`, and a parameter on
      `writeDocument`, which today derives the whole file from `contentJson`
      alone (`documents.ts:139`). Derive-before-write still holds: build the
      whole file string first, then open the writable
    - **`#reset()` must clear it** (`document.svelte.ts:184`). Miss that and
      opening document B after document A writes A's frontmatter into B's file —
      a corruption that crosses documents silently, which is the worst shape a
      bug can take in this app
    - **Nothing in the app may read the values.** A `title:` key must not start
      competing with the folder name, which is the only title authority
      (`documents.ts:123`), and the editor must not display or edit the block.
      Preservation only; a metadata panel is a separate decision
    - **Two edge cases.** A document that never had frontmatter must not gain an
      empty `---` fence on its first save. A file that is _only_ frontmatter
      leaves an empty body, which hits `fromMarkdown`'s empty-document guard
      (`from-markdown.ts:26`) and must keep its frontmatter alongside the empty
      doc
    - **Tests.** A frontmatter case in `round-trip.test.ts`, and an OPFS case in
      `documents.svelte.test.ts` proving read-then-write leaves an existing
      file's frontmatter intact. `renameDocument` needs no change — it copies
      files byte-for-byte (`documents.ts:196`)
    - Worth doing before the folder-tree item above: pointing the app at an
      existing Obsidian or Hugo folder is exactly what surfaces this, and it
      damages every file it opens
