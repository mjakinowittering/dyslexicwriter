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
- **Plain markdown files** — every document is saved as a real `.md` file on your own
  disk, not in a proprietary format or a database. Open it in any other editor, put it
  in version control, back it up, email it, move to a different app entirely — your
  writing is yours and it goes wherever you do.
- **A plain Files screen** — list your documents, create, open, rename, delete.
- **Word count and reading time** — always visible in the status bar, never in the way.
- **Two typefaces** — a standard sans-serif, or OpenDyslexic.
- **Two themes** — a neutral dark by default, or a neutral light (a hair off stark white).

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

## License

DyslexicWriter is released under the [MIT License](LICENSE) — use it, change it, ship
your own version of it.

The two typefaces it ships with are licensed separately, both under the
[SIL Open Font License 1.1](https://openfontlicense.org/):

- **OpenDyslexic** by Abelardo Gonzalez, bundled via `@fontsource/opendyslexic`
- **Geist** by Vercel, bundled via `@fontsource-variable/geist`

Both are self-hosted from `node_modules` rather than fetched from a CDN, so their
licence notices travel with the build.

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
      `src/app.html` already points at it (both the Open Graph and Twitter tags) and declare it 1200x630, so
      every link preview of the deployed site resolves to an empty image. The rest
      of the GitHub Pages work is done: the `404.html` fallback
      (`svelte.config.js`), `static/.nojekyll`, the base path from `BASE_PATH`
      via `actions/configure-pages`, the deploy workflow
      (`.github/workflows/build-and-deploy.yml`) and the full head metadata
      including the `<noscript>` prose. Add a real 1200x630 PNG under `static/`;
      the absolute URL is already correct.
      Direction settled: **A · Split, dark** — headline left, the editor window tilted on
      the right, in the app's own achromatic palette. Three things go with it: the window
      needs more separation from the near-black ground than `oklch(1 0 0 / 10%)` gives it
      (a light ring, ~`oklch(1 0 0 / 0.16)`, plus a soft glow); the tagline becomes "Write
      it. Hear it. Keep it."; and `src/app.html`'s `og:image:alt` still carries the old
      "write, and hear it back", so it changes in the same commit or the alt text
      describes a different picture. Re-render the mock once the highlight colours land
- [ ] Handle a pasted image the way a dropped one is handled. `PageEditor.svelte` wires
      `handleDrop` only, but its own prop doc for `onDropImage` and `writeImage`'s comment in
      `documents.ts` both say "dropped or pasted" — and `allowBase64: false` on the
      Image extension means a pasted image is discarded rather than degrading to a data
      URI, so nothing appears and nothing says why. Add `handlePaste` alongside
      `handleDrop`, taking the first `image/*` item off `event.clipboardData.files`,
      claiming the event, and routing it through the same `onDropImage` → `doc.addImage`
      path so the file lands in the document's own directory. The insertion position is
      the caret rather than `posAtCoords`; everything else is the drop handler's shape
- [ ] Fix the double rename fired by the title field. `edit/+page.svelte`'s title field binds
      both `onchange` and `onblur` to `renameFromTitle`, and for a text input `change`
      fires immediately before `blur` — so both run. The guard in the document store's `rename()` is `target === this.title`, and `this.title` is only
      updated _after_ `await renameDocument(...)` resolves, so the second call passes it
      and starts a concurrent rename against the same location. The writer sees a
      spurious "already exists", or the two race the `removeEntry` of the old file. One
      trigger is enough — `change` already fires on blur — or the store tracks the rename
      in flight and coalesces
- [ ] Route the reading-time copy through Paraglide.
      `src/lib/utils/calculateReadingTime.ts` builds `"3 minutes"`, `"45 seconds"` and
      `"1 hour 20 minutes"` in code, and `StatusbarTimeToRead.svelte` injects the result
      into `m.content_read_time({ time })` — English hardcoded in a util and smuggled
      through a message key. Return the parts (`{ hours, minutes, seconds }`) and let
      message keys own the words and the plurals, the way every other string in the app
      already works. `WelcomePreview.svelte` is the other call site

### Features

- [ ] Carry the read-aloud highlight onto list markers. Nothing is broken here — a
      bullet or number currently takes Tailwind Typography's default `prose` marker
      colour, and this is a customisation on top of it: while a spoken sentence sits
      inside a list item, its marker changes colour too, and returns when playback moves
      on. The marker takes the colour only, never the band. Doing it is structural rather
      than styling: `tiptap-tts-highlight.ts` emits `Decoration.inline` over text inside
      `<li><p>…</p></li>`, and `::marker` is generated content on the `<li>` that no
      inline span can reach — so it needs a `Decoration.node` on the enclosing list item
      when the sentence range covers it, styled as `::marker { color: … }` from that
      class in `PageEditor.svelte`'s `<style>` block, which also keeps the reading-font
      gradient band off it. Follows the highlight colours above, so do it after. Lists
      come from `StarterKit` (`src/lib/markdown/extensions.ts`), so nothing is added to
      the shared extension set and the round-trip is unaffected
- [ ] Show the read-aloud highlight in the welcome screen's editor preview —
      `WelcomePreview.svelte` draws the transport controls but never the band, so the one
      screen a stranger sees before handing over a folder doesn't show the feature the app
      is built around. The preview is a deliberate static mock, not a TipTap instance, so
      this is markup and CSS only: band one sentence in the sample prose with a word lit
      inside it. Follows the highlight colours above — do it after, not alongside, so
      there is one source of truth for the values
- [ ] Replace the welcome preview's sample copy with the DyslexicWriter product vision.
      `welcome_preview_title` and `welcome_preview_prose` (`messages/en.json`) are
      currently a lighthouse-keeper vignette — pleasant, but it spends the one piece of
      prose a new user reads on fiction. The vision would say what the app is for while
      demonstrating the reading experience. Copy to be written together; keep it short
      enough that the preview's sheet still shows the title plus a few lines. Re-render
      the mocks with it
- [ ] Consider a simple local version history for documents (deliberately not built in
      the initial fork — flagged as a future idea, not a commitment)
