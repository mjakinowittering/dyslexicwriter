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
│   ├── actions/
│   │   └── tooltip-suppression.svelte.ts   // hides portaled tooltip balloons during transitions
│   │
│   ├── components/
│   │   ├── Editor/                   // the whole editing surface; every file is
│   │   │   │                         // prefixed with its group's name
│   │   │   ├── Page/
│   │   │   │   ├── Page.svelte       //   the document sheet; `narrow` tweens the measure
│   │   │   │   └── PageEditor.svelte //   the TipTap instance + image drop handling
│   │   │   ├── Format/               //   the capped formatting controls (see content-editor)
│   │   │   │   ├── FormatToggle*.svelte      // bold, italic, lists, blockquote, hr, headings
│   │   │   │   └── FormatInsert*.svelte      // table, image
│   │   │   ├── Statusbar/            //   word count · reading time · save state
│   │   │   │   ├── StatusbarWordCount.svelte   // live word count
│   │   │   │   └── StatusbarTimeToRead.svelte  // reading-time estimate from that count
│   │   │   └── Toolbar/
│   │   │       ├── ToolbarRail.svelte      // the tall left rail (bare chevron)
│   │   │       ├── ToolbarSettings.svelte  // the gear
│   │   │       └── Toolbar{Play,Stop,SkipBack,SkipForward,Tts,VoiceSettings}.svelte
│   │   ├── EmptyState/               // generic empty/welcome/unsupported scaffold
│   │   ├── Settings/
│   │   │   └── SettingsPanel.svelte  // full-height right column: font + theme
│   │   ├── Tooltip/                  // wrapper over ui/tooltip — import from HERE
│   │   └── ui/                       // shadcn-svelte, added via CLI; do not hand-edit
│   │
│   ├── config/
│   │   └── motion.ts                 // shared durations/easing — the ONLY source of timings
│   │
│   ├── fs/                           // THE data layer — see the filesystem-storage skill
│   │   ├── config.ts                 //   read/write config.json
│   │   ├── documents.ts              //   scan, read, write, rename, delete, images
│   │   ├── handle-store.ts           //   the one IndexedDB row: the directory handle
│   │   └── support.ts                //   File System Access API feature detection
│   │
│   ├── markdown/                     // the round-trip — see the content-editor skill
│   │   ├── extensions.ts             //   THE shared node/mark set (editor + both converters)
│   │   ├── to-markdown.ts            //   JSON → markdown (what lands on disk)
│   │   └── from-markdown.ts          //   markdown → JSON (how a document reopens)
│   │
│   ├── models/                       // Valibot schemas — see models-validation
│   │   ├── config.model.ts           //   config.json shape + defaults + safe parse
│   │   ├── document.model.ts         //   title sanitisation, Untitled numbering
│   │   └── tts.model.ts              //   voice/rate bounds
│   │
│   ├── stores/
│   │   ├── workspace.svelte.ts       // folder handle, config, document index, status machine
│   │   ├── document.svelte.ts        // the open document: autosave, flush, rename, images
│   │   ├── theme.store.svelte.ts     // thin wrapper over mode-watcher
│   │   └── tooltips.svelte.ts        // tooltip suppression registry
│   │
│   ├── tts/                          // read-aloud — see the content-tts skill
│   │   ├── speech-controller.svelte.ts   // the `speech` singleton
│   │   ├── text-map.ts               //   offset ↔ ProseMirror mapping, chunking (pure)
│   │   ├── tiptap-tts-highlight.ts   //   decorations only, never marks/nodes
│   │   └── chirp.ts                  //   synthesized start/stop chirps (no assets)
│   │
│   ├── utils/
│   │   ├── calculateReadingTime.ts   // 238 wpm → { minutes, display }
│   │   └── relative-time.ts          // "2 hours ago" for the Files screen
│   └── utils.ts                      // `cn()` class merge
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

`ssr = false` and `prerender = false` app-wide (`routes/+layout.ts`);
`adapter-static` serves `index.html` as the SPA fallback for both.

| Route   | Purpose                                                                                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`     | **Files screen.** Also carries the three pre-workspace states: `unsupported` (no File System Access API), `loading` (checking IndexedDB), `needs-folder` (picker) |
| `/edit` | **Editor.** `?doc=<folder>` opens an existing document; no param starts a new in-memory `Untitled`                                                                |

`routes/+layout.svelte` only mounts `ModeWatcher`. The **theme** is pushed onto
`<html>` by `workspace.applyTheme()` — imperatively, when a folder is adopted and
when the setting changes. Do **not** move this into an `$effect`: mode-watcher
writes to the same element, and an effect that reads the preference while
mode-watcher mutates the class re-triggers itself
(`effect_update_depth_exceeded`).

The **font** preference never reaches `<html>`. It rides on the editor's `font`
prop (passed from `/edit`) and applies the `.reading-font` class to the document
surface alone, so OpenDyslexic dresses the writing and not the app chrome.

`routes/layout.css` holds every colour token (warm sepia `:root`, muted `.dark`),
the font tokens, and the self-hosted `@font-face` imports. **Never hardcode a
colour in a component.**

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
