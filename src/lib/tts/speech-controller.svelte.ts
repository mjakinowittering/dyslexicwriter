import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

import { defaultPreferences } from '$lib/models/config.model';
import type { TtsPreferences } from '$lib/models/tts.model';

import { playStartChirp, playStopChirp } from './chirp';
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
const VOICE_PREF_RE =
    /female|samantha|zira|serena|karen|moira|tessa|fiona|google uk english female/i;

// Chrome silently pauses long playback after ~15s; a periodic resume() defeats it.
// resume() on a non-paused synth is a no-op, so this is safe on other engines.
const KEEPALIVE_MS = 10_000;

// Skip-back restarts the current sentence once playback is this far into it, and
// steps back a sentence before that — the media-player convention. There is no
// playback clock to consult, so this measures from the sentence's own start stamp.
const SENTENCE_RESTART_MS = 1500;

function synth(): SpeechSynthesis | null {
    if (typeof window === 'undefined') return null;
    return window.speechSynthesis ?? null;
}

// Best default voice: a preferred-named English voice, else the first English
// voice, else the first available. Pure + exported for unit testing.
export function pickDefaultVoice(
    voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
    if (voices.length === 0) return null;
    const english = voices.filter((v) =>
        v.lang?.toLowerCase().startsWith('en')
    );
    const pool = english.length > 0 ? english : voices;
    return pool.find((v) => VOICE_PREF_RE.test(v.name)) ?? pool[0] ?? null;
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
 * - **Word highlight** requires `boundary` events. Chrome/Edge on Windows/macOS emit
 *   them (via SAPI/NSSpeech) and we light the exact word; Linux engines
 *   (speech-dispatcher/espeak) emit none, so word highlight is simply absent. We do
 *   **not** estimate word timing — predicting it from character counts drifts against
 *   a real engine, and a wrong highlight is worse than none.
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
    #keepAlive: ReturnType<typeof setInterval> | null = null;

    // The selection captured on pointer-down, before clicking the button can disturb
    // it. Consumed by the next play().
    #capturedRange: Range | null = null;

    // The live `voiceschanged` handler, kept so it can be removed again — holding it
    // also makes loadVoices() idempotent, so a remount can't stack listeners.
    #voicesChanged: (() => void) | null = null;

    // Populate the voice list. getVoices() is empty until the async load fires, so
    // we read it now and again whenever the engine says the list has changed.
    loadVoices(): void {
        const s = synth();
        if (!s || this.#voicesChanged) return;
        const apply = (): void => {
            this.voices = s.getVoices();
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
        s.cancel();
        // The engine can be left in a paused state by an earlier session; speak()
        // would then queue silently forever.
        s.resume();

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
        this.#startKeepAlive();
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
        s.speak(u);
    }

    #advance(): void {
        this.#chunkIndex += 1;
        if (this.#chunkIndex >= this.#chunks.length) {
            this.#finish();
            return;
        }
        this.#speakChunk();
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
        const s = synth();
        this.#detachCurrent();
        this.#current = null;
        if (!s) return;
        s.cancel();
        s.resume();
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

    pause(): void {
        const s = synth();
        if (!s || !this.isPlaying) return;
        s.pause();
        this.isPaused = true;
    }

    resume(): void {
        const s = synth();
        if (!s) return;
        s.resume();
        this.isPaused = false;
    }

    // Stop playback and clear the highlight (used on unmount / document switch).
    stop(): void {
        this.#teardown(true);
        synth()?.cancel();
    }

    // Natural end of the queue.
    #finish(): void {
        this.#teardown(true);
    }

    #teardown(chirp: boolean): void {
        const wasPlaying = this.isPlaying;
        // Detach so a pending cancel()/end doesn't re-enter teardown.
        this.#detachCurrent();
        this.#stopKeepAlive();
        this.#clearHighlight();
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

    // ── Keepalive ────────────────────────────────────────────────────────────────

    #startKeepAlive(): void {
        this.#stopKeepAlive();
        if (typeof window === 'undefined') return;
        this.#keepAlive = setInterval(() => {
            if (this.isPlaying && !this.isPaused) synth()?.resume();
        }, KEEPALIVE_MS);
    }

    #stopKeepAlive(): void {
        if (this.#keepAlive !== null) {
            clearInterval(this.#keepAlive);
            this.#keepAlive = null;
        }
    }
}

export const speech = new SpeechController();
