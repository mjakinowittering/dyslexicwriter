import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

import { defaultPreferences } from '$lib/models/config.model';
import type { TtsPreferences } from '$lib/models/tts.model';

import { playStartChirp, playStopChirp } from './chirp';
import { ScrollFollower } from './scroll-follower.svelte';
import {
    buildUtterance,
    chunkUtterance,
    nextSentenceStart,
    rangeToPos,
    sentenceStartAt,
    sentenceStartIndices,
    skipBackTarget
} from './text-map';
import type { Chunk, Range, Utterance } from './text-map';
import { setTtsHighlight } from './tiptap-tts-highlight';

// The shipped reading speed, from `src/lib/config/defaults.json`. Read once at
// module load — it is a checked-in default, not something that changes at
// runtime — and used for both the starting rate and the reset target, so the
// two can never disagree.
const DEFAULT_RATE = defaultPreferences().tts.rate;

// Names hinting at a female / "computer" voice, in rough preference order. Star
// Trek's Majel Barrett voice isn't installable, so we lean on whatever female
// English voice the device ships — the chirps + speech carry the flavour.
//
// This is a *tie-breaker within* the on-device pool, never a reason to reach past
// it (see pickDefaultVoice). Chrome's bundled `Google …` voices used to be named
// here explicitly; they are network voices and emit no `boundary` events at all,
// so choosing one made word highlighting structurally impossible.
const VOICE_PREF_RE = /female|samantha|zira|serena|karen|moira|tessa|fiona/i;

// Skip-back restarts the current sentence once playback is this far into it, and
// steps back a sentence before that — the media-player convention. There is no
// playback clock to consult, so this measures from the sentence's own start stamp.
const SENTENCE_RESTART_MS = 1500;

// Rough speaking speed at rate 1, used only to size the watchdog below. Deliberately
// an under-estimate of how fast an engine reads: a too-generous watchdog costs a
// pause, a too-eager one talks over the voice.
const CHARS_PER_SECOND = 12;

// How long past a chunk's estimated duration to wait before assuming its `end`
// event is never coming. Chrome drops `end` outright when it truncates a long
// utterance, and a lost `end` used to strand the read forever — the queue is
// chained on that one event.
const WATCHDOG_SLACK_MS = 8_000;

// How many `voiceschanged` fires in a row may find the same voice list before we
// stop answering them (see loadVoices). A real engine settles in two or three
// enumerations; past that the fires are our own getVoices() echoing back, and
// answering them is the loop that fills the tab's memory. Re-reading a list that
// has not changed is a no-op anyway, so a cap costs nothing when it is wrong.
const MAX_UNCHANGED_VOICE_READS = 3;

function synth(): SpeechSynthesis | null {
    if (typeof window === 'undefined') return null;
    return window.speechSynthesis ?? null;
}

/**
 * Best default voice, narrowing by three preferences in order of how much they
 * matter: **on-device before network**, then English, then a preferred name.
 *
 * On-device leads because it is the only one that changes what the app can do.
 * Word highlighting comes solely from `boundary` events, and a network voice —
 * Chrome's bundled `Google …` set, `localService === false` — emits none, so
 * picking one silently costs the writer the finer highlight. A network voice is
 * still chosen when the device has nothing local; reading aloud without word
 * highlighting beats not reading aloud.
 *
 * Pure + exported for unit testing.
 */
export function pickDefaultVoice(
    voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
    if (voices.length === 0) return null;

    // Each narrowing is skipped when it would empty the pool, so a device with
    // only network voices, or no English at all, still gets a sensible answer.
    const narrow = (
        pool: SpeechSynthesisVoice[],
        by: (voice: SpeechSynthesisVoice) => boolean
    ): SpeechSynthesisVoice[] => {
        const kept = pool.filter(by);
        return kept.length > 0 ? kept : pool;
    };

    const local = narrow(voices, (v) => v.localService);
    const english = narrow(local, (v) =>
        Boolean(v.lang?.toLowerCase().startsWith('en'))
    );
    return (
        english.find((v) => VOICE_PREF_RE.test(v.name)) ?? english[0] ?? null
    );
}

// Whether two voice lists name the same voices. Chrome hands back a fresh array
// of fresh objects from every getVoices() call, so identity says nothing — see
// loadVoices().
//
// Deliberately order-insensitive. Chrome assembles the list from two asynchronous
// sources (SAPI and the bundled Google TTS extension) and a re-enumeration can
// hand the same voices back in a different order; comparing position by position
// called that a change, reassigned the $state and invalidated every reader — the
// voice picker's two groups and its label — for a list nobody had altered. The
// order we keep is the one we already showed, which is also the steadier picker.
function sameVoices(
    a: SpeechSynthesisVoice[],
    b: SpeechSynthesisVoice[]
): boolean {
    if (a.length !== b.length) return false;
    const uris = new Set(a.map((voice) => voice.voiceURI));
    return b.every((voice) => uris.has(voice.voiceURI));
}

/**
 * What the toolbar reads and drives — the controller's surface, minus everything
 * playback keeps to itself.
 *
 * It exists so a story or a test can hand the transport controls a stand-in in a
 * chosen state: `canSkipBack` and `canSkipForward` are getters over private fields,
 * so there is no way to reach the enabled skip buttons by poking the singleton. The
 * app never passes it — every component defaults to `speech` below.
 */
export interface TtsTransport {
    readonly isPlaying: boolean;
    readonly isPaused: boolean;
    readonly canSkipBack: boolean;
    readonly canSkipForward: boolean;
    voices: SpeechSynthesisVoice[];
    voiceUri: string | null;
    rate: number;
    readonly preferences: TtsPreferences;
    captureSelection(editor: Editor | undefined): void;
    toggle(editor: Editor | undefined): void;
    stop(): void;
    skipBack(): void;
    skipForward(): void;
    resetToDefaults(): void;
}

/**
 * Singleton controller wrapping the Web Speech API.
 *
 * Text is spoken as a **queue of sentence-sized chunks**, not one long utterance:
 * browsers silently refuse to start an utterance that's too long (a whole document
 * never plays), and Chrome truncates around 15s. The queue is purely a playback
 * concern — it is not a highlight mechanism.
 *
 * Highlighting degrades by platform, and the two levels have different reliability:
 *
 * - **Sentence highlight** is driven by each chunk's real `onstart` event — exact,
 *   and works everywhere (no boundary events needed).
 * - **Word highlight** requires `boundary` events. On-device voices on Chrome/Edge for
 *   Windows/macOS emit them (via SAPI/NSSpeech) and we light the exact word; Linux
 *   engines (speech-dispatcher/espeak) and every *network* voice emit none, so word
 *   highlight is simply absent there. We do **not** estimate word timing — predicting
 *   it from character counts drifts against a real engine, and a wrong highlight is
 *   worse than none. What the app does instead is prefer an on-device voice by
 *   default (see pickDefaultVoice) and name the difference in the voice picker.
 *
 * Nothing here assumes the engine keeps its promises. A chunk that never reports
 * ending is advanced past by a watchdog, and every call into `speechSynthesis` is
 * guarded — a session that wedges with `isPlaying` true and no audio is the one
 * failure the transport cannot show its way out of.
 */
class SpeechController implements TtsTransport {
    isPlaying = $state(false);
    isPaused = $state(false);
    voices = $state<SpeechSynthesisVoice[]>([]);
    // The chosen voice's URI (null = use the suggested default) and reading speed.
    voiceUri = $state<string | null>(null);
    rate = $state(DEFAULT_RATE);

    // In-flight read context. #chunks stays a plain array on purpose: as $state it
    // would be deep-proxied, wrapping every chunk's `sentence` range — and those go
    // straight into ProseMirror decorations. Reactivity rides the two number fields.
    #editor: Editor | null = null;
    #utterance: Utterance | null = null;
    #chunks: Chunk[] = [];
    #chunkIndex = $state(0);
    // Where each sentence begins in #chunks — drives the skip controls.
    #sentenceStarts = $state<number[]>([]);
    // Date.now() when the current sentence started speaking (see SENTENCE_RESTART_MS).
    #sentenceStartedAt = 0;
    #current: SpeechSynthesisUtterance | null = null;
    // Fires if the in-flight chunk never reports ending (see WATCHDOG_SLACK_MS).
    #watchdog: ReturnType<typeof setTimeout> | null = null;

    // Scrolls the editor canvas to keep the text being read in view. Owned here
    // rather than exported as a second singleton — nothing else follows playback.
    #follower = new ScrollFollower();

    // The selection captured on pointer-down, before clicking the button can disturb
    // it. Consumed by the next play().
    #capturedRange: Range | null = null;

    // The live `voiceschanged` handler, kept so it can be removed again — holding it
    // also makes loadVoices() idempotent, so a remount can't stack listeners.
    #voicesChanged: (() => void) | null = null;
    // True while the handler below is running. See loadVoices().
    #readingVoices = false;
    // Consecutive reads that found nothing new — the loop breaker. See loadVoices().
    #unchangedVoiceReads = 0;

    /**
     * Populate the voice list, and keep it current. getVoices() is empty until the
     * engine's async load fires, so we read it now and again whenever the engine
     * says the list has changed.
     *
     * All three guards exist because of Chrome, where the list is assembled from two
     * asynchronous sources (SAPI and the bundled Google TTS component extension) and
     * is re-enumerated around playback — starting a read, pausing one, cancelling to
     * skip, choosing a different voice:
     *
     * - **Re-entrancy.** getVoices() can itself raise `voiceschanged`.
     * - **Identity.** Every getVoices() call returns a fresh array of fresh objects,
     *   so assigning unconditionally invalidates every reader of this `$state` on a
     *   fire that changed nothing. Assign only when the list really differs.
     * - **Settling.** The one that actually terminates the loop. `voiceschanged` is
     *   dispatched as a *task*, not synchronously, so the re-entrancy flag above is
     *   already back to false by the time our own read's echo arrives: read → event
     *   → read → event, unbounded, allocating a fresh array of fresh voice objects
     *   every turn until the tab is unusable. Nothing in the event says who caused
     *   it, so the only thing that can end it is the answer — a read that finds
     *   nothing new earns no further reads. The count resets the moment the list
     *   really does change, so an engine still loading its voices stays followed.
     */
    loadVoices(): void {
        const s = synth();
        if (!s || this.#voicesChanged) return;
        const apply = (): void => {
            if (this.#readingVoices) return;
            if (this.#unchangedVoiceReads >= MAX_UNCHANGED_VOICE_READS) return;
            this.#readingVoices = true;
            try {
                const next = s.getVoices();
                if (sameVoices(this.voices, next)) {
                    this.#unchangedVoiceReads += 1;
                } else {
                    this.voices = next;
                    this.#unchangedVoiceReads = 0;
                }
            } finally {
                this.#readingVoices = false;
            }
        };
        this.#voicesChanged = apply;
        apply();
        s.addEventListener('voiceschanged', apply);
    }

    // Drop the voice subscription — paired with loadVoices() on the editor's
    // lifecycle, so the listener doesn't outlive the screen that wanted it.
    unloadVoices(): void {
        const s = synth();
        if (!s || !this.#voicesChanged) return;
        s.removeEventListener('voiceschanged', this.#voicesChanged);
        this.#voicesChanged = null;
        // A later loadVoices() — the editor remounting on a document switch — is a
        // fresh screen asking a fresh question, not an echo of the last one.
        this.#unchangedVoiceReads = 0;
    }

    // Snapshot the current preferences for persistence.
    get preferences(): TtsPreferences {
        return { voiceUri: this.voiceUri, rate: this.rate };
    }

    // Skip is offered only inside a live session, mirroring Stop — pause() leaves
    // isPlaying true, so both stay usable while paused. Back is always available:
    // restarting the current sentence is meaningful even on the first one.
    get canSkipBack(): boolean {
        return this.isPlaying && this.#sentenceStarts.length > 0;
    }

    get canSkipForward(): boolean {
        return (
            this.isPlaying &&
            nextSentenceStart(this.#sentenceStarts, this.#chunkIndex) !== null
        );
    }

    // Hydrate from the saved profile prefs (null → suggested defaults).
    applyPreferences(prefs: TtsPreferences | null): void {
        this.voiceUri = prefs?.voiceUri ?? null;
        this.rate = prefs?.rate ?? DEFAULT_RATE;
    }

    // Revert customization to the suggested defaults.
    resetToDefaults(): void {
        this.voiceUri = null;
        this.rate = DEFAULT_RATE;
    }

    #resolveVoice(): SpeechSynthesisVoice | null {
        if (this.voiceUri) {
            const saved = this.voices.find((v) => v.voiceURI === this.voiceUri);
            if (saved) return saved; // absent on this device → fall through
        }
        return pickDefaultVoice(this.voices);
    }

    // Remember the editor's selection before a toolbar click moves focus, so
    // "select a passage, then press play" reliably reads just that passage.
    captureSelection(editor: Editor | undefined): void {
        if (!editor || editor.isDestroyed) {
            this.#capturedRange = null;
            return;
        }
        const { selection } = editor.state;
        this.#capturedRange = selection.empty
            ? null
            : { from: selection.from, to: selection.to };
    }

    // Play/pause/resume from a single control.
    toggle(editor: Editor | undefined): void {
        if (!editor) return;
        if (this.isPlaying && !this.isPaused) return this.pause();
        if (this.isPaused) return this.resume();
        this.play(editor);
    }

    // Read the current selection, or the whole document when nothing is selected.
    play(editor: Editor): void {
        const s = synth();
        if (!s) return;

        // Detach handlers first, then cancel — otherwise the cancelled utterance's
        // own onend would re-enter teardown.
        const captured = this.#capturedRange;
        this.#teardown(false);
        // The engine can be left in a paused state by an earlier session; speak()
        // would then queue silently forever.
        this.#resetEngine();

        const { doc, selection } = editor.state;
        const range = !selection.empty
            ? { from: selection.from, to: selection.to }
            : captured;
        const from = range?.from ?? 0;
        const to = range?.to ?? doc.content.size;

        const utterance = buildUtterance(doc, from, to);
        if (utterance.text.trim().length === 0) return;

        this.#editor = editor;
        this.#utterance = utterance;
        this.#chunks = chunkUtterance(utterance);
        this.#chunkIndex = 0;
        this.#sentenceStarts = sentenceStartIndices(this.#chunks);
        if (this.#chunks.length === 0) return;

        // The passage's text is captured — drop the selection so its highlight stops
        // sitting on top of the word/sentence decorations for the very text being read.
        if (range) this.#collapseSelection(editor, range.from);

        this.isPlaying = true;
        this.isPaused = false;
        playStartChirp();
        this.#speakChunk();
    }

    // Speak the chunk at #chunkIndex, chaining to the next one when it ends.
    #speakChunk(): void {
        const s = synth();
        const chunk = this.#chunks[this.#chunkIndex];
        if (!s || !chunk) {
            this.#finish();
            return;
        }

        const u = new SpeechSynthesisUtterance(chunk.text);
        const voice = this.#resolveVoice();
        if (voice) u.voice = voice;
        u.rate = this.rate;

        // Sentence highlight lands immediately from the chunk — exact, no boundary
        // events needed. Clear any word highlight from the previous chunk.
        u.onstart = () => this.#applyHighlight(null, chunk.sentence);
        // Word highlight only where the engine reports boundaries; otherwise this
        // never fires and the word stays unhighlighted (by design — no guessing).
        u.onboundary = (e) => this.#onBoundary(e, chunk);
        // Advance on error too, so one bad chunk can't strand the rest.
        u.onend = () => this.#advance();
        u.onerror = () => this.#advance();

        // Stamp when this sentence began; a multi-chunk sentence keeps the first
        // chunk's stamp. Set synchronously here rather than in onstart — a fast
        // second skip-back press can land before the engine fires onstart, and would
        // then read a stale stamp and restart instead of stepping back.
        if (
            sentenceStartAt(this.#sentenceStarts, this.#chunkIndex) ===
            this.#chunkIndex
        ) {
            this.#sentenceStartedAt = Date.now();
        }

        this.#current = u;
        this.#armWatchdog(chunk.text.length);
        // A throw here would leave the transport lit with no `end` event ever
        // coming — the one state the buttons can't explain. End the read instead.
        try {
            s.speak(u);
        } catch (error) {
            console.error('Read aloud could not speak a passage', error);
            this.#teardown(true);
        }
    }

    #advance(): void {
        this.#clearWatchdog();
        this.#chunkIndex += 1;
        if (this.#chunkIndex >= this.#chunks.length) {
            this.#finish();
            return;
        }
        // A pause that ended the chunk instead of holding it lands here — Chrome
        // does that for a remote voice, and so does Chrome on Linux generally. The
        // engine is paused, so speaking now would queue into it: silent until the
        // writer presses play, and then a sentence ahead of the highlight. Leave
        // the index on the chunk we owe and let resume() speak it.
        if (this.isPaused) {
            this.#detachCurrent();
            this.#current = null;
            return;
        }
        this.#speakChunk();
    }

    // ── Watchdog ─────────────────────────────────────────────────────────────────
    //
    // The queue is chained on `end`, so a chunk whose `end` never arrives stops the
    // read dead — highlight frozen on one sentence, transport still showing Pause,
    // and no way forward but Stop. Chrome does exactly this when it truncates an
    // utterance it considers too long. Rather than trust the event, give each chunk
    // a deadline: its estimated speaking time plus generous slack, after which we
    // move on as though it had ended normally.

    #armWatchdog(chars: number): void {
        this.#clearWatchdog();
        if (typeof window === 'undefined' || chars <= 0) return;
        const estimated = (chars / (CHARS_PER_SECOND * this.rate)) * 1000;
        this.#watchdog = setTimeout(() => {
            this.#watchdog = null;
            // Genuinely invisible otherwise: the read simply carries on, and only
            // the console says the engine stopped reporting.
            console.error(
                'Read aloud: no end event for a passage, skipping on'
            );
            // Cancel before moving on. If the estimate was simply short and the
            // engine is still talking, speaking the next chunk would queue behind
            // it and read the passage twice.
            this.#cancelCurrent();
            this.#advance();
        }, estimated + WATCHDOG_SLACK_MS);
    }

    #clearWatchdog(): void {
        if (this.#watchdog !== null) {
            clearTimeout(this.#watchdog);
            this.#watchdog = null;
        }
    }

    // ── Skipping ─────────────────────────────────────────────────────────────────
    //
    // Skipping moves by *sentence*, not by chunk: a sentence over MAX_CHUNK_CHARS is
    // spoken as several chunks, and stepping one chunk would land mid-sentence.
    // #sentenceStarts holds where each sentence begins.

    // Restart the current sentence, or step back one when we've only just entered it.
    skipBack(): void {
        if (!this.isPlaying) return;
        const restart =
            Date.now() - this.#sentenceStartedAt >= SENTENCE_RESTART_MS;
        this.#seek(
            skipBackTarget(this.#sentenceStarts, this.#chunkIndex, restart)
        );
    }

    // Jump to the next sentence. Past the last one this ends the read exactly as
    // letting it play out would — though the control is disabled there.
    skipForward(): void {
        if (!this.isPlaying) return;
        const target = nextSentenceStart(
            this.#sentenceStarts,
            this.#chunkIndex
        );
        if (target === null) {
            this.#cancelCurrent();
            this.#finish();
            return;
        }
        this.#seek(target);
    }

    // Jump to `index` and speak from there. A skip resumes a paused read: it's an
    // explicit "take me there" gesture, and re-pausing right after speak() races the
    // engine's start and leaks an audible fragment on some engines.
    #seek(index: number): void {
        this.#cancelCurrent();
        this.#chunkIndex = index;
        this.isPaused = false;
        // Land the sentence highlight now instead of waiting on the engine's onstart
        // (100-300ms later); onstart re-applies the same range, which is idempotent.
        this.#applyHighlight(null, this.#chunks[index]?.sentence ?? null);
        this.#speakChunk();
    }

    // Cancel the in-flight utterance *without* ending the session — chunks, editor
    // and utterance survive, and there's no stop chirp. Handlers come off before
    // cancel() (see #detachCurrent), and resume() follows it because an engine left
    // paused would queue the next speak() silently forever, as play() also guards.
    #cancelCurrent(): void {
        this.#detachCurrent();
        this.#current = null;
        this.#clearWatchdog();
        this.#resetEngine();
    }

    // Detach the in-flight utterance's handlers. cancel() fires onend on the
    // utterance it cancels, which would otherwise re-enter #advance()/#teardown.
    #detachCurrent(): void {
        if (!this.#current) return;
        this.#current.onstart = null;
        this.#current.onboundary = null;
        this.#current.onend = null;
        this.#current.onerror = null;
    }

    // Put the engine back to a state speak() can be trusted from: nothing queued and
    // not paused. The resume() is the load-bearing half — an engine left paused (by
    // a stop during a pause, or by an earlier session) swallows every later speak()
    // silently, which reads as read-aloud being broken with no error anywhere.
    // Both calls are guarded: a throw here must not take the transport with it.
    #resetEngine(): void {
        const s = synth();
        if (!s) return;
        try {
            s.cancel();
            s.resume();
        } catch (error) {
            console.error(
                'Read aloud could not reset the speech engine',
                error
            );
        }
    }

    pause(): void {
        const s = synth();
        if (!s || !this.isPlaying || this.isPaused) return;
        // Flagged *before* pause(), not after. Chrome ends the current utterance
        // rather than holding it for a remote voice, and that `end` re-enters
        // #advance() synchronously from inside this call — where it has to see the
        // read as already paused, or it speaks the next chunk into a paused engine.
        this.isPaused = true;
        s.pause();
        // A paused chunk is not a stalled one — the deadline would fire partway
        // through the pause and skip the sentence the writer stopped on.
        this.#clearWatchdog();
    }

    resume(): void {
        const s = synth();
        if (!s) return;
        this.isPaused = false;

        // Nothing in flight means the pause ended the chunk rather than holding it
        // (see #advance) — there is nothing for resume() to lift, so speak the
        // chunk we stopped on. #resetEngine clears the paused state first, or the
        // speak() queues silently forever.
        if (this.isPlaying && !this.#current) {
            this.#resetEngine();
            this.#speakChunk();
            return;
        }

        s.resume();
        // How much of the chunk is left is unknowable, so re-arm for the whole of
        // it. Waiting longer than necessary costs a delay; waiting too little talks
        // over the voice.
        const chunk = this.#chunks[this.#chunkIndex];
        if (this.isPlaying && chunk) this.#armWatchdog(chunk.text.length);
    }

    // Stop playback and clear the highlight (used on unmount / document switch).
    stop(): void {
        this.#teardown(true);
        this.#resetEngine();
    }

    // Natural end of the queue.
    #finish(): void {
        this.#teardown(true);
    }

    #teardown(chirp: boolean): void {
        const wasPlaying = this.isPlaying;
        // Detach so a pending cancel()/end doesn't re-enter teardown.
        this.#detachCurrent();
        this.#clearWatchdog();
        this.#clearHighlight();
        // The page stays exactly where the read left it — the writer carries on
        // from what they last heard — but nothing follows it any more.
        this.#follower.reset();
        this.#editor = null;
        this.#utterance = null;
        this.#chunks = [];
        this.#chunkIndex = 0;
        this.#sentenceStarts = [];
        this.#sentenceStartedAt = 0;
        this.#current = null;
        this.isPlaying = false;
        this.isPaused = false;
        if (chirp && wasPlaying) playStopChirp();
    }

    // ── Selection ────────────────────────────────────────────────────────────────

    // Collapse the editor selection at `at`. The transaction changes no content and
    // is kept out of the undo history, so it never marks the page dirty.
    #collapseSelection(editor: Editor, at: number): void {
        if (editor.isDestroyed) return;
        const { view } = editor;
        if (view.isDestroyed) return;

        const tr = view.state.tr.setSelection(
            TextSelection.near(view.state.doc.resolve(at))
        );
        tr.setMeta('addToHistory', false);
        view.dispatch(tr);

        // A view without DOM focus doesn't write the collapsed selection back to the
        // DOM — and the toolbar button has just taken focus (a read-only view can't
        // hold it at all) — so the browser would keep painting the old highlight.
        if (!view.hasFocus() && typeof window !== 'undefined') {
            window.getSelection()?.removeAllRanges();
        }
    }

    // ── Highlighting ─────────────────────────────────────────────────────────────

    #applyHighlight(word: Range | null, sentence: Range | null): void {
        if (!this.#editor || this.#editor.isDestroyed) return;
        setTtsHighlight(this.#editor.view, { word, sentence });
        // Every highlight change comes through here — onstart, #seek and
        // #onBoundary — so following the page rides the same one call. The word is
        // the finer target where the engine reports one; the sentence is what every
        // platform gets.
        this.#follower.follow(this.#editor.view, word ?? sentence);
    }

    #clearHighlight(): void {
        if (this.#editor && !this.#editor.isDestroyed) {
            setTtsHighlight(this.#editor.view, null);
        }
    }

    // Real word boundary from the engine (the only source of word highlight). A
    // chunk never straddles a sentence, so the sentence stays chunk.sentence.
    #onBoundary(e: SpeechSynthesisEvent, chunk: Chunk): void {
        if (e.name === 'sentence') return; // sentence comes from the chunk, not here
        if (!this.#utterance) return;

        // charIndex is relative to this chunk's text — shift it to the full utterance.
        const start = chunk.startOffset + e.charIndex;
        const length =
            e.charLength && e.charLength > 0
                ? e.charLength
                : this.#wordLengthAt(start);

        const word = rangeToPos(
            this.#utterance.segments,
            start,
            start + length
        );
        this.#applyHighlight(word, chunk.sentence);
    }

    // Fallback word length for engines that report a boundary without charLength:
    // extend to the next whitespace.
    #wordLengthAt(start: number): number {
        const text = this.#utterance?.text ?? '';
        const match = /\S+/.exec(text.slice(start));
        return match ? match[0].length : 0;
    }
}

export const speech = new SpeechController();
