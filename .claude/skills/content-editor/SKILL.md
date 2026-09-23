---
name: content-editor
description: The TipTap document editor — the shared extension set, the capped toolbar, and the markdown round-trip (`toMarkdown` / `fromMarkdown`). Load when changing the editor, adding or removing a formatting control, touching `$lib/markdown/*`, or wiring the editor to the document store.
---

# Content editor

The TipTap editor is the app. `JSONContent` is the editing model; **markdown on
disk is the format of record**. A document's only stored representation is its
`.md` file, so anything the editor can produce that markdown cannot express is
lost the next time the file is opened.

## Design principle — distraction-free, and staying that way

The editor is deliberately minimal, and that is a product constraint rather than a
gap. The writer sees their prose, a placeholder, and a quiet word count.

The toolbar is **capped**: undo/redo, headings, bold, italic, bullet/ordered/task
list, blockquote, horizontal rule, table, image, link. That is the whole list.

Undo and redo are on it because they surface a keymap the writer already has
(`Mod+Z`, `Shift+Mod+Z`) rather than adding a capability — the same reasoning
that keeps everything else off it.

- no font-family or font-size pickers (font choice is one setting, in the panel)
- no colour pickers, no alignment controls
- no bubble menus, no slash menus, no embeds or media widgets
- **Default to "no".** When in doubt, remove UI rather than add it.

Every stateful control on that row is a row in
`Editor/Format/definitions.ts` — icon, label, hint, shortcut, the `value` it
reports itself under, and the TipTap command. `getFormattingActive()` derives
from the same table, so a control's pressed key and the question asked of the
editor cannot disagree; the named components (`Format.Bold`, …) are thin wrappers
that pick one row. Undo, redo and the three inserts are not in it — they have no
on/off state to report.

## Links

The Link mark was always on (StarterKit, `openOnClick: false`) and always survived
the round-trip; `Editor/Link/` is the UI for it.

- **One dialog, three ways in** — the toolbar's `FormatInsertLink`, ⌘K
  (`link-keymap.ts`, an editor-only extension in `PageEditor`'s own list, never in
  `documentExtensions()`), and the link card's Edit. `open` lives on the edit page.
  The range is captured as the dialog opens, because it takes focus.
- **The card is shown on click only** — not on hover, and not when the caret moves
  into a link, where it would pop up under a writer editing nearby. It is the shadcn
  Popover anchored to the clicked `<a>` with `customAnchor`, and it leaves focus in
  the writing. **It is not a bubble menu**: no formatting, only where the link goes,
  Edit and Open. Don't rule on it again. Any document change closes it, because the
  redraw can take its anchor away.
- **Protocols are restricted in the dialog, not in the extension.**
  `normaliseLinkHref` (`$lib/utils/link.ts`) accepts `http:`, `https:` and `mailto:`
  only. The Link extension's `isAllowedUri` stays at TipTap's default on purpose: it
  also runs when a file is parsed, so narrowing it would strip the mark from every
  relative link, `#anchor` and `ftp:` link already in a writer's files — and the next
  autosave would write them back as plain text. The default still refuses
  `javascript:`, which `round-trip.test.ts` pins. Open is offered only for an address
  the dialog would make.
- **The external-link glyph is generated content** — an `a[href]::after` mask in
  `PageEditor.svelte`, filled with `currentColor`, its image built from the Hugeicons
  data by `iconDataUri`. Never a node, mark, widget or text: it must stay out of
  `getJSON()`, the markdown and read-aloud's text map.

The one deliberate exception is **read-aloud** — an accessibility feature for the
person this app is for, not chrome. See `[[content-tts]]`.

## The round-trip is the hard constraint

Three things must agree on the node set, or documents silently lose content:

1. the editor — what the writer can create
2. `toMarkdown` — what can be written to disk
3. `fromMarkdown` — what can be read back

They all call **one** factory, `documentExtensions()` in
`$lib/markdown/extensions.ts`, so they cannot drift. Adding a node there without
teaching turndown and marked about it will fail the round-trip tests, which is
exactly the point.

| File                                    | Responsibility                                      |
| --------------------------------------- | --------------------------------------------------- |
| `lib/markdown/extensions.ts`            | The single definition of the allowed node/mark set  |
| `lib/markdown/to-markdown.ts`           | JSON → HTML → normalise → markdown (turndown + GFM) |
| `lib/markdown/from-markdown.ts`         | markdown → HTML → JSON (marked + `generateJSON`)    |
| `lib/markdown/format.ts`                | Prettier over the derived markdown — the pure call  |
| `lib/markdown/format.worker.ts`         | That call, off the main thread                      |
| `lib/markdown/format-client.ts`         | The port, and the never-reject contract             |
| `tests/lib/markdown/round-trip.test.ts` | Every supported node, asserted byte-identical       |

`from-markdown.ts` also exports `emptyDocument()` — the one definition of the
`doc > paragraph` shape a blank document starts from. A new document, one created
from the Files screen, and a file that parsed to nothing all call it; none of them
writes the literal out.

**Adding a node or mark means, in the same commit:** add it to
`documentExtensions()`, confirm turndown emits it (add a rule if not), confirm
marked parses it, and add a round-trip case. A node that cannot survive the
round-trip does not get added to the editor.

### Serialiser quirks already handled — don't re-break them

- **turndown-plugin-gfm emits single-tilde `~struck~`**, which GFM does not
  recognise on the way back in. A custom rule emits `~~` instead.
- **TipTap wraps list-item and table-cell content in `<p>`**. Left alone, turndown
  renders loose lists (a blank line between bullets) and newlines inside table
  cells, which breaks table syntax outright. The `unwrapSoleParagraph` rule
  collapses the wrapper when the item's own text is that one paragraph —
  deliberately not "when it is the only child", because a nested list and a task
  item's checkbox both sit beside it without making the item loose.
- **Task lists need a normaliser at each end, and they are a matched pair.**
  TipTap buries the checkbox in a `<label>` and the content in a `<div>`, while
  turndown-plugin-gfm's `taskListItems` rule only fires on a checkbox that is a
  direct child of the `<li>` — so `normaliseTaskLists` in `to-markdown.ts`
  flattens the item into the shape that rule recognises. marked goes the other
  way, emitting a bare checkbox with no `data-type` for TipTap's `parseHTML` to
  match on, so `from-markdown.ts` carries a normaliser of the same name putting
  those attributes back. Break either one and every tick in the user's file is
  dropped the next time it is opened — silently, because the text survives.
- **A list mixing tasks and plain bullets becomes a task list**, the plain items
  gaining an empty box. TipTap's `taskList` holds `taskItem`s and nothing else.
  Likewise an ordered task list (`1. [ ] One`, which GFM allows) loses its
  numbering rather than its ticks — a lost number is visible, a lost tick is not.
- **TipTap emits `<th>` inside `<tbody>` with no `<thead>`**, and adds a
  `<colgroup>`. turndown-plugin-gfm detects the header row via `<thead>`, so
  without `normaliseTables()` it bails and writes raw HTML into the user's file.

## Editor component

`Editor/Page/PageEditor.svelte` owns the TipTap instance. It composes
`documentExtensions()` with three editor-only extensions that add **no content
nodes**: `Placeholder`, `CharacterCount`, and `TtsHighlightExtension`.

- `wordCount` is bindable and comes from `CharacterCount`; the status bar and
  reading-time estimate both read it.
- `onUpdate` is a dirty signal — the page reads `editor.getJSON()` at save time.
- `handleDrop` intercepts an image drop, writes the file into the document's own
  folder via the document store, and inserts a relative-path image node. It calls
  `preventDefault()` **before** awaiting, or the browser navigates to the file.
- `Page.svelte` is the document sheet. Its `narrow` prop mirrors the settings
  panel and tweens the measure — a persistent element, so a `Tween` rather than a
  `transition:` (see `[[animations]]`).

## Formatting on the way to disk

`toMarkdown` produces markdown that parses correctly and reads badly — `-   One`
with three spaces, `* * *` for a thematic break, unpadded table pipes, a paragraph
on one unbounded line. Prettier's markdown printer tidies all of it, wrapping prose
at `config.json`'s `prettier.printWidth`.

It runs **between `toMarkdown` and `joinFrontmatter`**, which is the only seam
where the markdown exists, the frontmatter is not yet attached (so Prettier's YAML
printer never sees the fence), and the writable is not yet open (so a throw cannot
truncate a chapter). `writeDocument` takes the formatter as a **parameter** — `fs/`
imports neither Prettier nor the worker.

Two things are load-bearing and easy to undo by accident:

- **`proseWrap` is what wraps.** `printWidth` alone does nothing to prose:
  Prettier's default `preserve` leaves every existing break where it is. Both keys
  are stored, and both matter.
- **The formatter never rejects.** `markdownFormatter.format()` answers every
  failure with the _unformatted_ body. The autosave retry has no give-up ceiling,
  so a rejection here loops forever on a document that never lands. Preferences are
  also rebuilt as plain values at the port — `workspace.config` is `$state`, and a
  Svelte proxy throws `DataCloneError` on `postMessage`.

`toMarkdown` cannot move into the worker (it needs `DOMParser` and `@tiptap/html`'s
browser build), and neither can the write — see `[[filesystem-storage]]` for why
`pagehide` skips formatting entirely.

Formatting changes the bytes deliberately; what must hold is that it never changes
the **document**. `round-trip.test.ts` asserts that, including the hazard of a
`1.`, `-`, `#`, `>` or `+` pushed to a line start by a wrap.

## Editing model rules

- Read-aloud highlighting is **ProseMirror decorations only**, never marks or
  nodes, so it can never appear in `editor.getJSON()` or reach the markdown.
- Never render document content as raw HTML. No `{@html}` on anything derived from
  a document or a filename.
- The editor seeds its content once (`loaded` guard) so a late load cannot clobber
  in-progress typing.
- Saving is the document store's job, not the editor's — see
  `[[filesystem-storage]]` for the autosave/flush contract.
