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

The toolbar is **capped**: undo/redo, headings, bold, italic, bullet/ordered
list, blockquote, horizontal rule, table, image. That is the whole list.

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
that pick one row. Undo, redo and the two inserts are not in it — they have no
on/off state to report.

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
  collapses the wrapper when it is the only child.
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

## Editing model rules

- Read-aloud highlighting is **ProseMirror decorations only**, never marks or
  nodes, so it can never appear in `editor.getJSON()` or reach the markdown.
- Never render document content as raw HTML. No `{@html}` on anything derived from
  a document or a filename.
- The editor seeds its content once (`loaded` guard) so a late load cannot clobber
  in-progress typing.
- Saving is the document store's job, not the editor's — see
  `[[filesystem-storage]]` for the autosave/flush contract.
