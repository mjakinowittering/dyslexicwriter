---
name: project-structure
description: The annotated `src/` folder tree and the route map. Load when you need to locate a file, decide where a new module belongs, or reason about the two routes and how they hand off to each other.
---

# Project structure

A static SPA with **two routes** and no server tier. Anything that would once have
been a server concern is now either a filesystem call or nothing at all.

## `src/`

```
src/
├── app.d.ts                  // ambient types — File System Access API only; no App.Locals
├── app.html                  // lang="en" hardcoded (no server hook to substitute it)
│
├── lib/
│   ├── components/
│   │   ├── AppHeader/                // the mark, theme toggle, folder menu
│   │   ├── AppFooter/                // licence + font credits; on every screen
│   │   ├── ConfirmDialog/            // the one confirm, for every destructive action
│   │   ├── Editor/                   // the whole editing surface; every file is
│   │   │   │                         // prefixed with its group's name
│   │   │   ├── Page/
│   │   │   │   ├── Page.svelte       //   the document sheet; `narrow` tweens the measure
│   │   │   │   └── PageEditor.svelte //   TipTap instance, image drop, reconcile()
│   │   │   ├── Format/               //   the capped formatting controls (see content-editor)
│   │   │   │   ├── definitions.ts            // THE table: icon/label/shortcut/value/command
│   │   │   │   ├── FormatToggleControl.svelte// renders one row of it
│   │   │   │   ├── FormatToggle*.svelte      // thin wrappers: bold, italic, lists, quote, headings
│   │   │   │   └── FormatInsert*.svelte      // table, image, hr, undo, redo
│   │   │   ├── Statusbar/            //   word count · reading time · save state
│   │   │   │   ├── StatusbarWordCount.svelte   // live word count
│   │   │   │   └── StatusbarTimeToRead.svelte  // reading-time estimate from that count
│   │   │   └── Toolbar/
│   │   │       ├── ToolbarRail.svelte      // the tall left rail (bare chevron)
│   │   │       ├── ToolbarSettings.svelte  // the gear
│   │   │       ├── ToolbarTts.svelte       // the transport group + its one Tooltip.Provider
│   │   │       ├── ToolbarTransportButton.svelte // one transport control
│   │   │       └── Toolbar{Play,Stop,SkipBack,SkipForward,VoiceSettings}.svelte
│   │   ├── EmptyState/               // generic empty/welcome/unsupported scaffold
│   │   ├── FileTree/                 // the Files screen's disclosure tree
│   │   │   ├── actions.ts            //   FileTreeActions + the one FileTreeNaming row
│   │   │   ├── FileTreeNameRow.svelte//   naming AND renaming — the same inline field
│   │   │   └── FileTree{,Document,RowMenu}.svelte
│   │   ├── Icon/                     // every icon draws through here (hugeicons data)
│   │   ├── Settings/
│   │   │   └── SettingsPanel.svelte  // full-height right column: font + theme
│   │   ├── Welcome/                  // first-run + reopen cards, editor preview
│   │   └── ui/                       // shadcn-svelte, added via CLI; do not hand-edit
│   │
│   ├── config/
│   │   ├── defaults.json             // first-run value of EVERY preference in config.json
│   │   ├── links.ts                  // footer URLs, derived from package.json
│   │   └── motion.ts                 // shared durations/easing — the ONLY source of timings
│   │
│   ├── fs/                           // THE data layer — see the filesystem-storage skill
│   │   ├── config.ts                 //   read/write config.json
│   │   ├── documents.ts              //   scan, read, write, rename, delete, images
│   │   ├── handle-store.ts           //   the one IndexedDB row: the directory handle
│   │   ├── io.ts                     //   writeFile + isNotFoundError, shared by the two above
│   │   └── support.ts                //   File System Access API feature detection
│   │
│   ├── markdown/                     // the round-trip — see the content-editor skill
│   │   ├── extensions.ts             //   THE shared node/mark set (editor + both converters)
│   │   ├── frontmatter.ts            //   split/join a `---` YAML fence, carried untouched
│   │   ├── to-markdown.ts            //   JSON → markdown (what lands on disk)
│   │   └── from-markdown.ts          //   markdown → JSON, plus emptyDocument()
│   │
│   ├── models/                       // Valibot schemas — see models-validation
│   │   ├── config.model.ts           //   config.json shape + defaults + safe parse
│   │   ├── document.model.ts         //   title sanitisation, Untitled numbering
│   │   └── tts.model.ts              //   voice/rate bounds
│   │
│   ├── stores/
│   │   ├── workspace.svelte.ts       // folder handle, config, document TREE, status machine
│   │   └── document.svelte.ts        // the open document: autosave, flush, rename, images
│   │
│   ├── tts/                          // read-aloud — see the content-tts skill
│   │   ├── speech-controller.svelte.ts   // the `speech` singleton
│   │   ├── text-map.ts               //   offset ↔ ProseMirror mapping, chunking (pure)
│   │   ├── tiptap-tts-highlight.ts   //   decorations only, never marks/nodes
│   │   ├── scroll-follower.svelte.ts //   keeps the spoken sentence on screen
│   │   ├── scroll-geometry.ts        //   the follow band, pure
│   │   └── chirp.ts                  //   synthesized start/stop chirps (no assets)
│   │
│   ├── utils/
│   │   ├── calculateReadingTime.ts   // 238 wpm → { minutes, display }
│   │   ├── relative-time.ts          // "2 hours ago" for the Files screen
│   │   ├── scroll-animator.svelte.ts // one rAF loop shared by the scrollers
│   │   └── shortcut.ts               // `Mod+B` → ⌘B or Ctrl+B, for tooltips
│   └── utils.ts                      // `cn()` class merge — shadcn's, do not hand-edit
│
├── routes/                           // see the route map below
├── stories/                          // Storybook, mirroring lib/components/
└── tests/                            // Vitest, mirroring lib/
    ├── lib/                          //   src/tests/lib/fs/documents.svelte.test.ts, …
    └── support/                      //   shared harnesses (opfs.ts)
```

There is **no** `lib/server/`, no `hooks.server.ts`, no `.remote.ts`, no
`+page.server.ts`. If you find yourself wanting one, the answer is a filesystem
call in `lib/fs/`.

## Routes

`ssr = false` app-wide (`routes/+layout.ts`), and **`prerender = true`** — the two
are not the same question. With SSR off, prerendering emits a _shell_ per route
(`index.html`, `edit.html`) and runs no component code at build time. That shell
is what makes GitHub Pages answer the site's public URL with a 200 and the
metadata in `app.html`; without it the build has no `index.html`, Pages falls
through to `404.html`, and the home page is served under a 404 that crawlers read
as "nothing here". `404.html` still catches every other path, which is how
reloading a route survives.

| Route   | Purpose                                                                                                                                                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`     | **Files screen.** Also carries the five pre-workspace states: `unsupported`, `loading`, `needs-folder`, `needs-permission` (Reopen card), `folder-missing` (look again, or let it go)                                              |
| `/edit` | **Editor.** `?doc=` is the markdown file's path relative to the working folder — `notes.md`, `Chapters/One.md`. A bare folder name still resolves, for links made before the tree existed. No param starts an in-memory `Untitled` |

`routes/+layout.svelte` only mounts `ModeWatcher`. The **theme** is pushed onto
`<html>` by `workspace.applyTheme()` — imperatively, when a folder is adopted and
when the setting changes. Do **not** move this into an `$effect`: mode-watcher
writes to the same element, and an effect that reads the preference while
mode-watcher mutates the class re-triggers itself
(`effect_update_depth_exceeded`).

The **font** preference never reaches `<html>`. It rides on the editor's `font`
prop (passed from `/edit`) and applies the `.reading-font` class to the document
surface alone, so OpenDyslexic dresses the writing and not the app chrome.

`routes/layout.css` holds every colour token (neutral greys throughout — a
near-white `:root`, a near-black `.dark`), the font tokens, and the self-hosted
`@font-face` imports. **Never hardcode a colour in a component**, including in
script: `--ground-light` / `--ground-dark` sit on `:root` unconditionally so the
root layout can _read_ the two theme grounds for mode-watcher's `themeColors`
rather than restating them as hex.

## Where things go

- A new **persisted setting** → `config.json` (schema in `models/config.model.ts`,
  accessor on the workspace store). Never `localStorage`, never IndexedDB.
- A new **filesystem operation** → `lib/fs/documents.ts`, with an OPFS test under
  `src/tests/lib/fs/`.
- A new **editor node** → `markdown/extensions.ts` **plus** both converters **plus**
  a round-trip test (`src/tests/lib/markdown/`), in the same commit.
- A new **UI string** → `messages/en.json`, then recompile Paraglide.
- A new **component** → `lib/components/<Name>/`, with its story mirrored under
  `src/stories/<Name>/`.
- A new **test** → `src/tests/`, at the mirrored path of what it tests.
