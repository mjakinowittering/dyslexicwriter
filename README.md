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
- **Two themes** — a neutral light (a hair off stark white) and a neutral dark.

## How your documents are stored

You pick one working folder the first time you open the app. Inside it:

```
my-writing/                  <- the folder you chose
├── config.json              <- all your preferences, and nothing else
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

`config.json` holds **every** preference (theme, font, read-aloud voice and speed) and
nothing else. Because it lives in your folder rather than in browser storage, moving
that folder to another machine or browser brings your settings along with your writing.

Your list of documents is not stored anywhere. The app reads it from the folder each
time it needs it — when you open the app, when you come back to the Files screen, and
when you switch back to the tab — so a file you add, rename or delete outside the app
shows up as soon as you look.

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

Split into **Bugs** — something already built that doesn't behave as intended — and
**Features** — work not yet built, plus the decisions and chores that go with it.
Within each, related items sit next to each other.

### Bugs

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
- [ ] Ship a real `og:image`. `static/og-image.png` is a 0-byte placeholder, but
      `src/app.html:36` and `:52` already point at it and declare it 1200x630, so
      every link preview of the deployed site resolves to an empty image. The rest
      of the GitHub Pages work is done: the `404.html` fallback
      (`svelte.config.js:21`), `static/.nojekyll`, the base path from `BASE_PATH`
      via `actions/configure-pages`, the deploy workflow
      (`.github/workflows/build-and-deploy.yml`) and the full head metadata
      including the `<noscript>` prose. Add a real 1200x630 PNG under `static/`;
      the absolute URL and alt text are already correct

### Features

- [ ] Read-aloud: karaoke-style auto-scroll to keep the spoken word in view as playback
      advances (the sentence highlight is in place; scrolling to follow it is not)
- [ ] Consider a simple local version history for documents (deliberately not built in
      the initial fork — flagged as a future idea, not a commitment)
- [ ] Give the welcome and Files screens a shared footer, for licence information,
      a link back to GitHub and a short note from the author — contents still to be
      decided. The shared header now exists (`src/lib/components/AppHeader/`,
      rendered above every state of `/`), so the footer is the other half of that
      chrome and should sit as its sibling in `src/routes/+page.svelte`. The
      repository and homepage URLs are already in `package.json:7-11`, so the
      GitHub link can read from those rather than hardcode a string.
    - **There is no licence to point at yet.** No `LICENSE` file, no `license` field
      in `package.json` (it is `private: true`) and no `## License` section in this
      README, so a licence has to be chosen before the footer can name one — for the
      app itself and for what ships inside it, starting with OpenDyslexic, bundled
      via `@fontsource/opendyslexic` (`src/routes/layout.css:9-12`)
    - The app is a static SPA with no server, so the footer is markup and Paraglide
      copy only — nothing fetched, no analytics, no external assets
