---
description: Draw ASCII wireframes of UI changes, and sequence diagrams of data flows, for the user to approve before anything is built. Load before planning or building any change a user will see (a new screen, component, state, or a moved control) and whenever a flow crosses the editor, the stores and the filesystem — or when the user asks to "see it", for a wireframe, a mock-up or a diagram.
name: ascii-wireframes
---

# ASCII wireframes

The user reads a wireframe faster than a paragraph, and one drawing catches a
misunderstanding that three rounds of prose miss. **Draw first, build second:** any
change a user will see gets a wireframe the user has approved before its code is
written. When feedback on a built screen changes the layout, redraw before rebuilding.

They're often read in the VS Code chat panel, where only plain ASCII is reliably one
column wide: box-drawing characters (`- | +` drawn as their Unicode cousins) render
narrower than letters, and symbol glyphs render wider or narrower again, so a row
containing any of them drifts out of line. **Draw with printable ASCII only.**

## What to draw

- **Every state, not just the happy one.** This app has more of them than most, and
  they are exactly where the surprise hides:
    - the Files screen's five pre-workspace states — `unsupported`, `loading`,
      `needs-folder`, `needs-permission` (the Reopen card), `folder-missing`
    - an empty working folder, and one holding only files the app cannot open (they
      must not read alike)
    - a folder the depth cap left unloaded, closed and awaiting a click
    - the editor mid-save, saved, and with a save that failed and is retrying
    - a document being read aloud, with the sentence banded
- **Before and after** for a change to something that exists. Label them `BEFORE` /
  `AFTER`.
- **The neighbours.** Draw enough of what surrounds the change (the app header, the
  status bar, the settings panel beside it) to show where it sits and what it pushes
  aside. Where a thing lives is as much the design as how it looks.
- **Real copy and real icons.** Use the actual strings from `messages/en.json`
  ("Nothing here yet", "Saved just now"), never lorem ipsum. Name an icon with a short
  ASCII word in brackets (`[refresh]`, `[trash]`, `[x]`), and name the **Hugeicons**
  icon in a note underneath — this project draws every icon from Hugeicons data
  through `Icon/Icon.svelte`.
- **Every screen it touches.** A shared component shown on both routes gets drawn on
  the one where it's hardest to fit — usually `/edit`, with the settings panel open and
  the editor squeezed.

## How to draw

- Put each wireframe in a fenced code block with no language.
- Borders are `+` for corners and junctions, `-` across and `|` down. Buttons are
  `[ Label ]`, an icon button is `[x]`, a text input is `[ placeholder... ]`, a
  dropdown is `[ Value  v ]`, a checked item is `*` and an ellipsis is `...`.
- No character outside printable ASCII anywhere in the block: no box-drawing, arrows,
  ticks, ellipsis glyphs or emoji, in the drawing or its labels.
- Keep a width of about 90 columns or less; every row of a box ends in the same column.
- **Check the widths before you show it** — counting by eye drifts. Write the drawings
  to a scratch file and print each row's length:
  `awk '{ printf "%3d %s\n", length($0), $0 }' wireframe.txt`. Every row of one box
  must print the same number; fix any that doesn't, then paste the checked text.
- Put notes **below** the drawing, as plain bullets. Never write annotations inside
  the boxes, or a note wide enough to break the alignment.
- One region per drawing. The status bar, the settings panel and the document sheet
  are separate drawings.

## Sequence diagrams for data flows

When the work moves a document between the editor, the stores, the worker and the
folder on disk, draw the sequence as well, and **name the data types**.

1. First, list each piece of data as a table: where it lives, the shape
   (`JSONContent`, `DocumentLocation`, `string` of markdown) and what it is handed to.
2. Then one diagram per path: participants across the top, arrows down the page, the
   payload written on each arrow. Draw the failure path as well as the success path —
   in this app the failure path is the one that matters, because it is where writing
   gets lost.

```
Writer   PageEditor       doc store        format worker      folder
  |           |               |                   |               |
  |- types --->               |                   |               |
  |           |- applyEdit --->                   |               |
  |           |               | 5s debounce       |               |
  |           |               |- toMarkdown ------>               |
  |           |               <- wrapped md ------|               |
  |           |               |- writeFile ----------------------->
  |           |               <- entry ---------------------------|
  |           |               |                   |               |
  |           |               | ... the write throws instead ...  |
  |           |               | dirty = true, saveState = error   |
  |           |               |- retry 5s, doubling -------------->
```

- The formatter never rejects: a failure there answers with the unformatted body, and
  the save proceeds. Draw that, not a rejection.
- `pagehide` and `visibilitychange` skip the worker entirely — if the flow you are
  drawing is an exit path, the worker column is not in it.

## Keep it light

A wireframe is a question, not a spec. Keep the prose around it short, end with one
question ("Build it?" plus the one or two decisions it exposes), and ask that question
with AskUserQuestion. If the answer is a change, redraw only the part that changed.
