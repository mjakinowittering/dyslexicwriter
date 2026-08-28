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
- [ ] Settle the last Storybook a11y failure, then enforce the checks.
      `@storybook/addon-a11y` is wired (`.storybook/main.ts`) but still runs as
      `test: 'todo'` (`.storybook/preview.ts:26`), so violations surface in the
      Storybook UI and never fail a run. The editor and the speed slider now
      have accessible names, which leaves exactly **one** failing story out of
      95 — everything else passes under `'error'` today.
    - **The canvas reads as a keyboard-inaccessible scroll region**
      (`scrollable-region-focusable`, the Page `Long document` story).
      `Page.svelte:56` scrolls on overflow and is neither focusable nor
      guaranteed to hold focusable content. Confirmed **not** a product defect:
      `Page` is only ever used as `Page.Root` wrapping
      `Page.Editor` (`edit/+page.svelte:166`), whose contenteditable is
      focusable and satisfies the rule. The story is the artifact — it renders
      the sheet around static prose. Either disable that one rule for that one
      story (`parameters.a11y.config.rules`, verified to work) or give the story
      focusable content; do not change the component
    - **Only the dark theme is ever scanned.** `withThemeByClassName` sets
      `defaultTheme: 'dark'` (`.storybook/preview.ts:10`) and the test run takes
      the default global, so no story is axe-checked in the warm light theme and
      every light-theme contrast defect is invisible. Worth deciding whether
      enforcement should cover both themes before the flag is flipped
    - **Nothing checks the routes.** `/` and `/edit` have no stories, so
      landmarks, heading order and the focus path across rail → title → toolbar
      → editor → settings are outside the addon's reach entirely. Out of scope
      here; noted so the green run isn't read as more than it is
    - **Then flip `test: 'todo'` to `test: 'error'`** so the suite holds the
      line. Doing that before the canvas story is settled only leaves the run red
- [ ] Add the two missing Storybook stories. Every component under
      `src/lib/components/` has a story in the mirrored `src/stories/` tree except
      `Editor/Statusbar/StatusbarSaveState.svelte` and
      `Editor/Statusbar/StatusbarUnsaved.svelte`. Their behaviour is not untested —
      `Statusbar.stories.svelte` already drives `idle`/`saving`/`saved`/`pending`
      and both `savedAt` cases through the composite — but neither leaf appears in
      the autodocs tree beside its siblings `StatusbarWordCount` and
      `StatusbarTimeToRead`, so the two chips a writer relies on to know their work
      has landed can't be viewed or checked on their own. `StatusbarSaveState` wants
      four stories (`saving`, a fresh save inside `FRESH_MS`, an aged save via
      `editor_saved_when`, and `savedAt: null` rendering nothing);
      `StatusbarUnsaved` wants two (`pending`, and hidden otherwise). Follow
      `StatusbarWordCount.stories.svelte` for shape. `src/lib/components/ui/` is
      shadcn-vendored and deliberately storyless, so it stays out of scope — and
      note this lands ~6 more stories on the a11y run counted above
- [ ] Neutralise the colour palette — roll both themes back towards shadcn-svelte's
      default neutral greys. Nothing is broken here: the tokens do what they were
      specified to do, and it is the specification that is changing. Every value in
      both blocks of `src/routes/layout.css` carries chroma on a warm hue —
      `oklch(0.965 0.014 85)` for the light background, `oklch(0.245 0.008 62)` for
      the dark — and it is that chroma across the whole set, not any single token,
      that makes the dark theme read as brown. Set chroma to `0` throughout and
      re-pitch the lightness steps against shadcn-svelte's neutral palette. The dark
      theme goes all the way to the reference: a near-black page, ~`oklch(0.26 0 0)`
      chrome, mid-grey active states, near-white ink. The light theme stays a hair
      off pure white (~`oklch(0.98 0 0)` rather than shadcn's `oklch(1 0 0)`) — the
      one deliberate departure from the defaults. The `--canvas`/`--sheet`
      relationship survives untouched: the writing surface already steps towards
      mid-grey from the chrome in both themes, and only the hue and the size of the
      step change
    - **The docs move in the same commit.** "Light is warm sepia … dark is muted"
      (`CLAUDE.md:443`), the two-themes bullet (`README.md:21`) and the
      `project-structure` skill's "warm sepia `:root`, muted `.dark`"
      (`.claude/skills/project-structure/SKILL.md:112`) all assert the palette being
      removed. The `never #fff` half of that invariant survives — an off-white light
      background keeps it true — so only the warmth is struck out
    - **The read-aloud highlight is the one colour that stays.** The yellow sentence
      and word tints in `PageEditor.svelte:208-222` are the only hardcoded colours
      outside `layout.css`. They are functional signal rather than theme, and a grey
      highlight on a grey page would not read at all; leave them, but re-check them
      against the new backgrounds
    - **Scope: colour tokens only.** The reference image also shows a segmented,
      grouped toolbar — the toolbar's shape and its capped control set are not in
      question here. Note the overlap with the table-styling bug above: whichever
      lands second authors its borders against the palette that landed first
