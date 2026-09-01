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

| File                                         | Role                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$lib/tts/text-map.ts`                       | **Pure, unit-tested.** Builds the utterance string from a doc range + a segment map, splits it into speakable chunks, translates char offsets back to ProseMirror positions, and resolves sentence-skip targets (`buildUtterance`, `chunkUtterance`, `rangeToPos`, `splitSentences`, `sentenceStartIndices`, `sentenceStartAt`, `nextSentenceStart`, `skipBackTarget`). |
| `$lib/tts/tiptap-tts-highlight.ts`           | TipTap `Extension` + ProseMirror plugin holding a `DecorationSet`; `setTtsHighlight(view, { word, sentence } \| null)` drives it, and `isTtsHighlightTransaction(tr)` lets `onTransaction` subscribers skip one.                                                                                                                                                        |
| `$lib/tts/chirp.ts`                          | Web Audio chirp synthesis (`playStartChirp` / `playStopChirp`).                                                                                                                                                                                                                                                                                                         |
| `$lib/tts/speech-controller.svelte.ts`       | `SpeechController` runes **singleton** `speech` — wraps `speechSynthesis`, owns playback + voice/rate state, wires boundary events to the highlight. `pickDefaultVoice` is pure + exported, and unit-tested.                                                                                                                                                            |
| `Editor/Toolbar/ToolbarPlay.svelte`          | Play/pause button (`speech.toggle(editor)`).                                                                                                                                                                                                                                                                                                                            |
| `Editor/Toolbar/ToolbarSkipBack.svelte`      | Previous-sentence button (`speech.skipBack()`); gated on `speech.canSkipBack`.                                                                                                                                                                                                                                                                                          |
| `Editor/Toolbar/ToolbarSkipForward.svelte`   | Next-sentence button (`speech.skipForward()`); gated on `speech.canSkipForward`.                                                                                                                                                                                                                                                                                        |
| `Editor/Toolbar/ToolbarVoiceSettings.svelte` | Popover: voice `Select` + speed `Slider` + reset; calls a `persist` prop (debounced).                                                                                                                                                                                                                                                                                   |
| `$lib/tts/scroll-geometry.ts`                | **Pure, unit-tested.** Where the canvas should scroll to keep the spoken text inside the comfort band, or `null` to leave it alone (`followScrollTarget`, `BAND_TOP`, `BAND_BOTTOM`, `ANCHOR`).                                                                                                                                                                         |
| `$lib/tts/scroll-follower.svelte.ts`         | `ScrollFollower` — resolves the canvas from the view, turns a `Range` into content coordinates, and drives a `ScrollAnimator`. Owned privately by `SpeechController`.                                                                                                                                                                                                   |
| `Editor/Page/PageBackToTop.svelte`           | The floating button `Page` shows mid-read; stops the read and glides the canvas home.                                                                                                                                                                                                                                                                                   |

Registration: `TtsHighlightExtension` is added to the editor's extension array in
`Editor/Page/PageEditor.svelte`; the buttons live in the top `Toolbar.Group` in
`routes/(app)/content/+page.svelte`, which also hydrates `speech` and owns its lifecycle.

## Two platform realities that shape the whole design

These are not theoretical — both were hit in practice, and the design exists to survive them.

1. **You cannot speak a long text as one utterance.** Browsers _silently_ refuse to start an
   utterance that's too long (a whole document simply never plays — **no error, nothing in the
   console**), and Chrome truncates playback around 15s. So text is spoken as a **queue of
   sentence-sized chunks** (`chunkUtterance`, `MAX_CHUNK_CHARS = 140`), each its own
   `SpeechSynthesisUtterance`, chained via `onend` → `#speakChunk()`. **Never go back to a single
   utterance for the whole document.** The queue is _only_ a playback concern — not a highlight
   mechanism.
    - The cap is **characters, but the limit it guards is time**, so it has to hold at the slowest
      rate offered: `MAX_CHUNK_CHARS` and `TTS_RATE_MIN` (0.75) are a pair, and neither moves
      alone. 180 chars was ~25s at the old 0.5x floor — comfortably truncated, which is exactly
      what the cap exists to prevent.
    - **A chunk's `end` event cannot be trusted.** Chrome drops it outright when it truncates, and
      the whole queue is chained on it, so a lost one used to strand the read forever — highlight
      frozen, transport still showing Pause. Every chunk now carries a **watchdog**
      (`#armWatchdog`): estimated duration + `WATCHDOG_SLACK_MS`, then `#cancelCurrent()` and move
      on. It is cleared on pause and re-armed on resume, or a long pause would skip a sentence.
    - There is **no keepalive interval any more.** `#keepAlive` called a bare `resume()` every 10s,
      which is a spec no-op on a synth that is not paused — so it never did anything about the
      cutoff it was written for, while `resume()` during active speech is implicated in Chrome
      restarting the current utterance. Chunk sizing and the watchdog cover this properly. **Do not
      bring it back.**
2. **Many speech engines emit no word-`boundary` events at all** — every browser on Linux (via
   speech-dispatcher/espeak), **and every network voice everywhere**, including Chrome's bundled
   `Google …` set. This is the whole reason highlighting degrades by platform, and the reason
   `pickDefaultVoice` ranks `localService` above everything else (see below).

## Highlighting degrades gracefully — and word timing is NEVER estimated

The two highlights have different reliability, and the product decision is to lean on that instead of
faking the unreliable one:

- **Sentence highlight** is driven by each chunk's real `onstart` event, from the precomputed
  `chunk.sentence` range. It is **exact and always on**, on every platform — no boundary events
  needed. A chunk never straddles a sentence, so the sentence is simply `chunk.sentence` (there is no
  `sentenceAt` lookup).
- **Word highlight** comes **only** from real `boundary` events (`#onBoundary`: `chunk.startOffset +
charIndex` → `rangeToPos`). Where the engine emits them (an **on-device** voice on Chrome/Edge for
  Windows/macOS) the exact word lights up. Where it doesn't — Linux, or any network voice — word
  highlight is **absent from the canvas, with no indicator on it**. That part of the rule stands.
  What changed is that the app no longer leaves the writer unable to _act_ on it — see the two
  rules below.
- **`pickDefaultVoice` narrows on-device → English → preferred name**, in that order, each step
  skipped rather than allowed to empty the pool. On-device leads because it is the only preference
  that changes what the app can _do_. A network voice is still chosen when the device has nothing
  local — reading aloud without word highlighting beats not reading aloud. `VOICE_PREF_RE` is a
  tie-breaker _within_ the local pool, never a reason to reach past it; it used to name
  `google uk english female` outright, which is how this went wrong. Covered by
  `src/tests/lib/tts/speech-controller.test.ts` (node project — the function is pure).
- **The voice `Select` is grouped** "On this device" / "From the internet", with a line under it
  saying internet voices don't highlight each word. The note lives in the picker; **never put it on
  the canvas.** Shown by the `Grouped Voices` story, which closes the list again before the a11y
  pass — an open bits-ui `Select` puts `aria-activedescendant` on a plain button, which axe
  rejects and the call site cannot finish fixing.

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
  Use `#cancelCurrent()`: detach handlers (`#detachCurrent`) → clear the watchdog →
  `#resetEngine()`. Detaching **before** cancelling is mandatory, since `cancel()` fires the
  cancelled utterance's own `onend` and would re-enter `#advance()`, landing the skip a chunk
  late. `#resetEngine()` is the one place `cancel()` and `resume()` are called, always as a pair
  and always inside a `try`: a `cancel()` on a paused engine leaves it paused and the next
  `speak()` queues silently forever, and a throw out of either must not take the transport with
  it. `play()` and `stop()` both go through it too.
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
- **Lifecycle:** `speech.stop()` on editor unmount, on document switch (the `{#key}` block
  remounts/destroys the editor) **and on `pagehide`** — otherwise audio bleeds across documents
  and the highlight targets a destroyed view. `pagehide` is the one `onDestroy` cannot cover: it
  doesn't run on a tab close or reload, and Chrome's speech queue outlives the page that started
  it. `visibilitychange` deliberately does **not** stop a read — listening while looking at
  another window is using the feature. **Detach utterance handlers before `cancel()`** (that's
  what `#teardown` does first), or the cancelled utterance's own `onend` re-enters teardown.
- **A highlight move is a real transaction, and it is dispatched per word.** Anything subscribed
  to `onTransaction` must call `isTtsHighlightTransaction(tr)` and return — none of what those
  subscribers recompute (word count via a full-document `textBetween`, active formatting,
  undo/redo availability) can have changed, because the transaction touches neither doc nor
  selection. `PageEditor.svelte` is the one gate; skipping there also skips the page's handler.
  Not doing this is what froze the tab on Windows, where boundary events actually fire.
- **Never measure layout per boundary event.** `ScrollFollower.follow()` stores the newest range
  and does its `coordsAtPos`/`scrollHeight` reads on a single `requestAnimationFrame` — those
  force layout, land right after ProseMirror rewrote the DOM, and arrive faster than the page
  paints. `reset()` cancels any frame still owed.
- **`getVoices()` can raise `voiceschanged`.** `loadVoices()`'s handler holds a re-entrancy flag
  and only assigns `this.voices` when the list really differs (`sameVoices`) — Chrome on Windows
  re-enumerates as playback starts, and handling that from inside the handler is an unbounded loop
  that pegs the tab. Every call returns fresh objects, so identity proves nothing.
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
  read back, since that file is hand-editable. Never widen without reason: **lowering
  `TTS_RATE_MIN` means resizing `MAX_CHUNK_CHARS` in the same commit**, or slow reads go back to
  being truncated. Moving the bound also invalidates stored values outside it — a saved `0.5`
  falls back to the default rate, per the key-by-key parse in `config.model.ts`.
- **The speed heading and the speed presets share one message** (`content_tts_speed_option`), so
  they cannot disagree: formatting the heading separately with `toFixed(1)` rendered the slowest
  preset as "0.8×" above a button reading "0.75×".
- **Voices are device-specific.** A saved `voiceUri` is resolved by identity at runtime
  (`pickDefaultVoice` fallback when absent). "Reset to defaults" clears `voiceUri` + restores rate.

## Following the voice down the page

Playback scrolls the editor canvas to keep the spoken text in view, and offers a way back
when it is done.

- **One seam, the same one the highlight uses.** `#applyHighlight` calls
  `follower.follow(view, word ?? sentence)` after `setTtsHighlight`, so `onstart`, `#seek`
  and `#onBoundary` are all covered by that single call. The word is the finer target where
  the engine reports one; the sentence is what every platform gets — the same graceful
  degradation as the highlight itself.
- **A comfort band, not a fixed anchor.** `followScrollTarget` (pure, in
  `scroll-geometry.ts`) scrolls only when the target falls outside roughly the top
  15%–70% of the canvas, and then brings it to ~30% down. A document that already fits on
  one screen never moves, and a sentence taller than the band anchors its top **once**
  rather than asking for the same scroll on every word.
- **Scrolling is done to the DOM, never through a transaction.** No `tr.scrollIntoView()`
  — that rides the selection and would reach the dirty signal.
- **Motion is a `Tween`**, via the shared `ScrollAnimator`
  (`$lib/utils/scroll-animator.svelte.ts`) at `followScrollDuration` — not
  `scrollTo({ behavior: 'smooth' })`, which is state-driven motion the project doesn't
  hand-roll. Reduced motion jumps instead. The animator holds an `$effect.root` because
  the follower is a plain module, and must be `destroy()`ed — `#teardown` does it via
  `follower.reset()`.
- **The canvas is found by `[data-tts-scroll]`** (`Editor/Page/Page.svelte`), not by
  walking ancestors guessing at `overflow`. No such ancestor — Storybook, a standalone
  editor — and following is silently off.
- **Back to top is a read-aloud control.** `Page` floats `PageBackToTop` at the
  bottom-right while `reading` and the canvas is scrolled past the first screen; clicking
  it **stops the read** and glides home. That is what makes it work at all — a read that
  carried on would scroll straight back to the spoken sentence — and it is the deliberate
  counterpart to Stop, which leaves the page where it is so writing can continue from the
  last thing heard.
