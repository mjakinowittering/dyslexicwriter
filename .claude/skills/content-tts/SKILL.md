---
name: content-tts
description: The read-aloud / text-to-speech feature in the editor — Web Speech API playback with sentence (and where supported, word) highlighting, chirps, and voice/speed prefs persisted in config.json. Load when working on `$lib/tts/*`, the play/pause or voice-settings toolbar buttons, the highlight decoration extension, the SpeechController, the chirp synth, or the offset→ProseMirror-position mapping.
---

# Read-Aloud (Text-to-Speech)

A **Read aloud** control in the content-editor top toolbar speaks the current selection
(or the whole document when nothing is selected) via the browser's **Web Speech API**
(`window.speechSynthesis`) — no network, no third-party library. As it reads, the current
**word** and its enclosing **sentence** are highlighted, advancing with playback. Playback
start/stop is punctuated with synthesized **LCARS-style chirps**. Voice + reading speed are
user-tunable and **persisted in `config.json`**.

This complements the deliberately-minimal editor (see [[content-editor]]): the read-aloud
controls are an **accepted, intentional accessibility addition** to the top `Toolbar` (a
dyslexia aid), not on-canvas chrome — do not strip them under the "keep the editor minimal" rule.

## File map

| File                                                | Role                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$lib/tts/text-map.ts`                              | **Pure, unit-tested.** Builds the utterance string from a doc range + a segment map, splits it into speakable chunks, translates char offsets back to ProseMirror positions, and resolves sentence-skip targets (`buildUtterance`, `chunkUtterance`, `rangeToPos`, `splitSentences`, `sentenceStartIndices`, `sentenceStartAt`, `nextSentenceStart`, `skipBackTarget`). |
| `$lib/tts/tiptap-tts-highlight.ts`                  | TipTap `Extension` + ProseMirror plugin holding a `DecorationSet`; `setTtsHighlight(view, { word, sentence } \| null)` drives it.                                                                                                                                                                                                                                       |
| `$lib/tts/chirp.ts`                                 | Web Audio chirp synthesis (`playStartChirp` / `playStopChirp`).                                                                                                                                                                                                                                                                                                         |
| `$lib/tts/speech-controller.svelte.ts`              | `SpeechController` runes **singleton** `speech` — wraps `speechSynthesis`, owns playback + voice/rate state, wires boundary events to the highlight.                                                                                                                                                                                                                    |
| `ContentEditor/Toolbar/ToolbarPlay.svelte`          | Play/pause button (`speech.toggle(editor)`).                                                                                                                                                                                                                                                                                                                            |
| `ContentEditor/Toolbar/ToolbarSkipBack.svelte`      | Previous-sentence button (`speech.skipBack()`); gated on `speech.canSkipBack`.                                                                                                                                                                                                                                                                                          |
| `ContentEditor/Toolbar/ToolbarSkipForward.svelte`   | Next-sentence button (`speech.skipForward()`); gated on `speech.canSkipForward`.                                                                                                                                                                                                                                                                                        |
| `ContentEditor/Toolbar/ToolbarVoiceSettings.svelte` | Popover: voice `Select` + speed `Slider` + reset; calls a `persist` prop (debounced).                                                                                                                                                                                                                                                                                   |

Registration: `TtsHighlightExtension` is added to the editor's extension array in
`ContentEditor/Editor/Editor.svelte`; the buttons live in the top `Toolbar.Group` in
`routes/(app)/content/+page.svelte`, which also hydrates `speech` and owns its lifecycle.

## Two platform realities that shape the whole design

These are not theoretical — both were hit in practice, and the design exists to survive them.

1. **You cannot speak a long text as one utterance.** Browsers _silently_ refuse to start an
   utterance that's too long (a whole document simply never plays — **no error, nothing in the
   console**), and Chrome truncates playback around 15s. So text is spoken as a **queue of
   sentence-sized chunks** (`chunkUtterance`, `MAX_CHUNK_CHARS = 180`), each its own
   `SpeechSynthesisUtterance`, chained via `onend` → `#speakChunk()`. **Never go back to a single
   utterance for the whole document.** The queue is _only_ a playback concern — not a highlight
   mechanism. A `#keepAlive` interval calls `resume()` every 10s as insurance against the 15s pause.
2. **Many speech engines emit no word-`boundary` events at all** (every browser on Linux, via
   speech-dispatcher/espeak). This is the whole reason highlighting degrades by platform.

## Highlighting degrades gracefully — and word timing is NEVER estimated

The two highlights have different reliability, and the product decision is to lean on that instead of
faking the unreliable one:

- **Sentence highlight** is driven by each chunk's real `onstart` event, from the precomputed
  `chunk.sentence` range. It is **exact and always on**, on every platform — no boundary events
  needed. A chunk never straddles a sentence, so the sentence is simply `chunk.sentence` (there is no
  `sentenceAt` lookup).
- **Word highlight** comes **only** from real `boundary` events (`#onBoundary`: `chunk.startOffset +
charIndex` → `rangeToPos`). Where the engine emits them (Chrome/Edge on Windows/macOS) the exact
  word lights up. Where it doesn't (Linux), word highlight is **silently absent** — no indicator.

**Do not reintroduce word-timing estimation.** An earlier version predicted word timings from
character counts (a fixed rate, then a self-calibrating least-squares fit of `duration ≈ overhead +
chars/speed`, then clause-sized chunks to bound the error). It was all deleted. Character count can't
track a real engine — espeak stretches stressed syllables and expands tokens (`1999` →
"nineteen ninety-nine") — so the highlight always drifted, and a wrong highlight reads worse than
none. If perfect word sync on Linux is ever required, the answer is **cloud TTS with word
timestamps** (Azure/Google/ElevenLabs), not local estimation.

The full rationale and the dead-ends are recorded in Amendments 1–3 of
`~/.claude/plans/*playful-quilt.md`.

A boundary event's `charIndex` is **relative to its chunk** — always add `chunk.startOffset`
before mapping through `rangeToPos`. Getting this wrong highlights the wrong word.

## Skipping is by sentence, never by chunk

`⏮` / `⏭` move a whole **sentence**, which is not the same as a chunk: a sentence over
`MAX_CHUNK_CHARS` is spoken as several chunks, so stepping `#chunkIndex ± 1` would land
mid-sentence. Every chunk carries a `sentenceIndex`, and `sentenceStartIndices` reduces the
queue to the index where each sentence begins — `#sentenceStarts`. Group by that field, **not**
by `chunk.sentence` object identity: identity happens to work today but breaks on a `null`
range, and would break silently if `#chunks` ever became `$state` (deep proxying replaces the
shared reference).

- **`#chunks` must stay a plain array.** As `$state` it would proxy every chunk's `sentence`
  range, and those go straight into ProseMirror decorations. Reactivity for the buttons' enabled
  state rides two number fields only: `#chunkIndex` and `#sentenceStarts`.
- **A skip must not call `#teardown`** — that wipes `#chunks`/`#editor`/`#utterance` and chirps.
  Use `#cancelCurrent()`: detach handlers (`#detachCurrent`) → `cancel()` → `resume()`. Detaching
  **before** cancelling is mandatory, since `cancel()` fires the cancelled utterance's own `onend`
  and would re-enter `#advance()`, landing the skip a chunk late. The trailing `resume()` is the
  same guard `play()` uses: a `cancel()` on a paused engine leaves it paused and the next
  `speak()` queues silently forever.
- **Skip-back's restart-vs-previous threshold is time-based** (`SENTENCE_RESTART_MS`), stamped
  synchronously in `#speakChunk` — not in `onstart`, which lands 100–300 ms later and would let a
  fast second press read a stale stamp. A structural test ("past the sentence's first chunk")
  cannot work: any sentence under the cap is a _single_ chunk, so it would never restart one.
- **Skipping resumes a paused read**, and plays no chirp — chirps mark session start/stop only.

## Hard rules

- **Highlighting is ProseMirror decorations only — never marks/nodes.** Decorations don't appear
  in `editor.getJSON()`, so they can't leak into the server's derived markdown
  (`toMarkdown`, capped at the shared extension set). Never implement the highlight as a mark. The
  highlight transaction sets `addToHistory: false` and doesn't change the doc, so it never marks
  the page dirty.
- **SSR-guard every browser API.** `speechSynthesis`, `AudioContext`, `window` are all reached
  behind `typeof window === 'undefined'` (project convention) or from `onMount`/click handlers.
- **Chirps are synthesized Web Audio — no audio asset files.** Do not add `.mp3`/`.ogg` assets.
- **Motion rule still applies.** The highlight advances by decoration change (no CSS transition —
  that would be hand-rolled state-driven motion, which is forbidden). Any _reveal_ animation must
  use `$lib/config/motion.ts` + native Svelte (see [[animations]]).
- **The offset→position map is the fragile part.** It lives in `text-map.ts` and is covered by
  `text-map.test.ts` (round-trips: doc text at mapped positions === the utterance substring). Keep
  it pure and keep the tests green when touching it.
- **Lifecycle:** `speech.stop()` on editor unmount **and** on document switch (the `{#key}` block
  remounts/destroys the editor) — otherwise audio bleeds across documents and the highlight
  targets a destroyed view. **Detach utterance handlers before `cancel()`** (that's what
  `#teardown` does first), or the cancelled utterance's own `onend` re-enters teardown. `play()`
  also calls `resume()` after `cancel()` — an engine left paused by an earlier session would
  otherwise queue `speak()` silently forever.
- **Selection playback:** reading a selected passage works because `ToolbarPlay` calls
  `speech.captureSelection(editor)` on **`onpointerdown`** — before the click can move focus — and
  `play()` consumes that captured range. Don't drop that: relying on the live selection alone at
  click time is what makes "select a passage, press play" feel broken.

## Preferences persistence

Voice + speed live in the `tts` field of **`config.json`** in the user's working folder
(`{ voiceUri: string | null; rate: number }`, null voice = suggested default). Like every other
persisted preference in this app they belong there and nowhere else — never `localStorage`, never
IndexedDB. Because they sit in the user's folder, they travel with the writing to another machine.
See [[filesystem-storage]], [[models-validation]].

The wiring is two call sites, both in `routes/edit/+page.svelte`:

- **Read** — `speech.applyPreferences(workspace.config.tts)` once the workspace is ready.
- **Write** — `ToolbarVoiceSettings`'s debounced `persist` prop calls
  `workspace.setTtsPreferences(prefs)`, which writes through to `config.json`.

`$lib/tts/*` itself knows nothing about storage: the controller exposes `applyPreferences()` and a
`preferences` getter, and that is the whole seam. Keep it that way.

- **`rate` is bounded** (`TTS_RATE_MIN`..`TTS_RATE_MAX`) and **`voiceUri` length-capped** in the
  Valibot schema — validated in `tts.model.test.ts`, and re-validated whenever `config.json` is
  read back, since that file is hand-editable. Never widen without reason.
- **Voices are device-specific.** A saved `voiceUri` is resolved by identity at runtime
  (`pickDefaultVoice` fallback when absent). "Reset to defaults" clears `voiceUri` + restores rate.

## Not built (future)

- Karaoke-style auto-scroll to keep the spoken word in view (tracked in the README `## Todo`).
