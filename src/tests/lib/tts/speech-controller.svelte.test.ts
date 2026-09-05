import type { Editor } from '@tiptap/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { speech } from '$lib/tts/speech-controller.svelte';
import { setTtsHighlight } from '$lib/tts/tiptap-tts-highlight';
import type { TtsHighlight } from '$lib/tts/tiptap-tts-highlight';

// The stateful half of the controller — what `speech-controller.test.ts` (node,
// pure) cannot reach. Both suites here guard failures that end a writing session
// rather than spoiling a sentence: a tab that fills its memory until the browser
// kills it, and a pause the read never comes back from.
//
// Driven against a stand-in engine rather than the browser's own: `speechSynthesis`
// speaks out loud, has no way to be told to misbehave, and behaves differently on
// every platform — and misbehaviour is the whole subject.

interface FakeVoice {
    voiceURI: string;
    name: string;
    lang: string;
    localService: boolean;
    default: boolean;
}

function voice(uri: string): FakeVoice {
    return {
        voiceURI: uri,
        name: uri,
        lang: 'en-GB',
        localService: true,
        default: false
    };
}

// The highlight is a ProseMirror decoration and the editor here is a stand-in,
// so the funnel is watched rather than driven into a real view. What matters is
// the range the controller works out, not how ProseMirror paints it.
vi.mock('$lib/tts/tiptap-tts-highlight', () => ({
    setTtsHighlight: vi.fn()
}));

// `speechSynthesis` is a getter on window, so it is replaced rather than assigned.
function installSynth(synth: object): void {
    Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        get: () => synth
    });
}

describe('SpeechController voice enumeration', () => {
    // getVoices() can itself raise `voiceschanged`, and the event is dispatched as
    // a task — so a handler that answers every fire re-reads forever, allocating a
    // fresh array of fresh voice objects each turn. That is what filled the tab.
    it('stops re-reading a voice list that has stopped changing', async () => {
        let calls = 0;
        const target = new EventTarget();
        const voices = [voice('a'), voice('b')];

        installSynth({
            getVoices() {
                calls += 1;
                // The echo: reading the list schedules another `voiceschanged`.
                setTimeout(
                    () => target.dispatchEvent(new Event('voiceschanged')),
                    0
                );
                return voices;
            },
            addEventListener: target.addEventListener.bind(target),
            removeEventListener: target.removeEventListener.bind(target)
        });

        speech.unloadVoices();
        speech.loadVoices();
        await new Promise((resolve) => setTimeout(resolve, 250));
        speech.unloadVoices();

        // A handful of reads while the list settles, then silence — not the
        // hundreds an unbounded loop manages in the same quarter second.
        expect(calls).toBeLessThanOrEqual(4);
        expect(speech.voices).toHaveLength(2);
    });

    it('keeps following an engine whose list is still filling up', async () => {
        // Chrome assembles the list from two asynchronous sources, so the first
        // read is routinely empty and the second short. Settling must not be
        // mistaken for that — a writer whose voices never arrive has no read-aloud.
        const target = new EventTarget();
        const lists = [[], [voice('a')], [voice('a'), voice('b')]];
        let read = 0;

        installSynth({
            getVoices() {
                const list = lists[Math.min(read, lists.length - 1)];
                read += 1;
                return list;
            },
            addEventListener: target.addEventListener.bind(target),
            removeEventListener: target.removeEventListener.bind(target)
        });

        speech.unloadVoices();
        speech.loadVoices();
        target.dispatchEvent(new Event('voiceschanged'));
        target.dispatchEvent(new Event('voiceschanged'));
        speech.unloadVoices();

        expect(speech.voices.map((v) => v.voiceURI)).toEqual(['a', 'b']);
    });

    it('treats a reordered list as the same list', async () => {
        // Two async sources means the same voices can come back in either order.
        // Reassigning on that invalidates the picker's groups and its label for a
        // change nobody made — and it hides the settling above, because the list
        // never compares equal.
        const target = new EventTarget();
        const first = [voice('a'), voice('b')];
        const second = [voice('b'), voice('a')];
        let read = 0;

        installSynth({
            getVoices: () => (read++ === 0 ? first : second),
            addEventListener: target.addEventListener.bind(target),
            removeEventListener: target.removeEventListener.bind(target)
        });

        speech.unloadVoices();
        speech.loadVoices();
        const before = speech.voices;
        target.dispatchEvent(new Event('voiceschanged'));
        speech.unloadVoices();

        expect(speech.voices).toBe(before);
    });
});

// The real SpeechSynthesisUtterance refuses a voice it did not mint, and the
// stand-in engine below deals only in stand-ins.
class FakeUtterance {
    text: string;
    voice: unknown = null;
    rate = 1;
    onstart: (() => void) | null = null;
    onboundary: ((event: SpeechSynthesisEvent) => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
        this.text = text;
    }
}

// Three sentences, each comfortably under MAX_CHUNK_CHARS, so the read is three
// chunks and `#sentenceStarts` is [0, 1, 2] — which is what makes skipping by
// sentence distinguishable from skipping by chunk.
const SAMPLE_TEXT =
    'One two three four. Five six seven eight. Nine ten eleven twelve.';

// The bits of a TipTap editor the controller touches. A real one would need a
// mounted view; nothing under test here reads the document beyond its text.
function fakeEditor() {
    const text = SAMPLE_TEXT;
    const tr = { setMeta: () => tr };
    const doc = {
        content: { size: text.length + 2 },
        resolve: (at: number) => at,
        nodesBetween(
            _from: number,
            _to: number,
            fn: (node: unknown, pos: number) => boolean
        ) {
            fn({ isText: true, text, isBlock: false }, 1);
        }
    };
    return {
        isDestroyed: false,
        state: { doc, selection: { empty: true, from: 0, to: 0 } },
        view: {
            isDestroyed: false,
            state: { doc, tr },
            dispatch: () => {},
            hasFocus: () => true,
            dom: { closest: () => null }
        }
    };
}

describe('SpeechController pause', () => {
    beforeEach(() => {
        vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // An engine that ends the current utterance instead of holding it — Chrome for
    // any remote voice, and Chrome on Linux generally.
    function pausingSynth() {
        const state = { spoken: [] as string[], paused: false };
        let current: { onend?: (() => void) | null } | null = null;

        const synth = {
            speak(u: {
                text: string;
                onstart?: () => void;
                onend?: () => void;
            }) {
                state.spoken.push(u.text);
                current = u;
                if (!state.paused) u.onstart?.();
            },
            cancel() {
                const ending = current;
                current = null;
                ending?.onend?.();
            },
            pause() {
                state.paused = true;
                const ending = current;
                current = null;
                ending?.onend?.();
            },
            resume() {
                state.paused = false;
            },
            getVoices: () => [],
            addEventListener: () => {},
            removeEventListener: () => {}
        };
        return { synth, state };
    }

    it('does not speak the next sentence into a paused engine', () => {
        const { synth, state } = pausingSynth();
        installSynth(synth);

        play();
        const spokenBeforePause = state.spoken.length;
        speech.pause();

        // The engine's `end` arrives from inside pause(). Advancing past it is
        // right; speaking is not — the utterance would sit in a paused queue,
        // silent, and start a sentence ahead of the highlight on resume.
        expect(state.spoken).toHaveLength(spokenBeforePause);
        expect(speech.isPaused).toBe(true);
        expect(speech.isPlaying).toBe(true);

        speech.stop();
    });

    it('speaks the chunk it owes when the read resumes', () => {
        const { synth, state } = pausingSynth();
        installSynth(synth);

        play();
        const first = state.spoken[0];
        speech.pause();
        speech.resume();

        // Resume has nothing to lift, so it starts the sentence the pause landed
        // on — the next one, and only once.
        expect(state.spoken).toHaveLength(2);
        expect(state.spoken[1]).not.toBe(first);
        expect(state.paused).toBe(false);
        expect(speech.isPaused).toBe(false);

        speech.stop();
    });

    it('ignores a second pause rather than stalling the read', () => {
        const { synth, state } = pausingSynth();
        installSynth(synth);

        play();
        speech.pause();
        const spoken = state.spoken.length;
        speech.pause();

        expect(state.spoken).toHaveLength(spoken);

        speech.resume();
        expect(state.spoken.length).toBeGreaterThan(spoken);

        speech.stop();
    });
});

// A well-behaved engine: speaks when asked, reports start, and holds a pause
// rather than ending the utterance. It reports `end` only when told to, so a
// test can simply decline to — which is the failure the watchdog exists for.
function scriptedSynth() {
    const state = {
        spoken: [] as string[],
        cancelled: 0,
        paused: false
    };
    let current: FakeUtterance | null = null;

    const synth = {
        speak(u: FakeUtterance) {
            state.spoken.push(u.text);
            current = u;
            if (!state.paused) u.onstart?.();
        },
        cancel() {
            state.cancelled += 1;
            current = null;
        },
        pause() {
            state.paused = true;
        },
        resume() {
            state.paused = false;
        },
        getVoices: () => [],
        addEventListener: () => {},
        removeEventListener: () => {}
    };

    return {
        synth,
        state,
        // Deliver the `end` the engine owes, the way a healthy one would.
        finishChunk() {
            const ending = current;
            current = null;
            ending?.onend?.();
        },
        boundary(event: Partial<SpeechSynthesisEvent>) {
            current?.onboundary?.(event as SpeechSynthesisEvent);
        }
    };
}

// The stand-in satisfies only the slice of Editor the controller reads, so it is
// widened through `unknown` rather than typed as the whole interface.
const play = (editor: unknown = fakeEditor()): void =>
    speech.play(editor as unknown as Editor);

// The queue is chained on `end`, so a chunk whose `end` never arrives stops the
// read dead: highlight frozen on one sentence, the transport still offering
// Pause, and no way forward but Stop. Chrome does exactly this when it truncates
// an utterance it considers too long — the tab-freeze this machinery was added
// for. Rather than trust the event, each chunk gets a deadline.
describe('SpeechController watchdog', () => {
    beforeEach(() => {
        vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
        vi.useFakeTimers();
    });

    afterEach(() => {
        speech.stop();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('moves past a chunk whose end event never arrives', async () => {
        const { synth, state } = scriptedSynth();
        installSynth(synth);

        play();
        expect(state.spoken).toHaveLength(1);

        // The engine says nothing further. Without the deadline the read is over
        // and the writer has no way to tell.
        await vi.advanceTimersByTimeAsync(30_000);

        expect(state.spoken.length).toBeGreaterThan(1);
    });

    // If the estimate was simply short and the engine is still talking, speaking
    // the next chunk would queue behind it and read the passage twice.
    it('cancels the stalled utterance before moving on', async () => {
        const { synth, state } = scriptedSynth();
        installSynth(synth);

        play();
        await vi.advanceTimersByTimeAsync(30_000);

        expect(state.cancelled).toBeGreaterThan(0);
    });

    // A paused chunk is not a stalled one. Leaving the deadline armed would fire
    // partway through the pause and skip the sentence the writer stopped on.
    it('does not fire while the read is paused', async () => {
        const { synth, state } = scriptedSynth();
        installSynth(synth);

        play();
        const spoken = state.spoken.length;
        speech.pause();

        await vi.advanceTimersByTimeAsync(60_000);

        expect(state.spoken).toHaveLength(spoken);
        expect(speech.isPaused).toBe(true);
    });

    // …and it has to come back, or a chunk that stalls after a pause strands the
    // read exactly as before.
    it('is armed again when the read resumes', async () => {
        const { synth, state } = scriptedSynth();
        installSynth(synth);

        play();
        speech.pause();
        speech.resume();
        const spoken = state.spoken.length;

        await vi.advanceTimersByTimeAsync(30_000);

        expect(state.spoken.length).toBeGreaterThan(spoken);
    });

    // The whole queue drains on deadlines alone, and the session ends properly
    // rather than sitting lit with nothing playing.
    it('reaches the end of the read on deadlines alone', async () => {
        const { synth } = scriptedSynth();
        installSynth(synth);

        play();
        await vi.advanceTimersByTimeAsync(120_000);

        expect(speech.isPlaying).toBe(false);
    });
});

// Skipping moves by sentence, not by chunk: a sentence over MAX_CHUNK_CHARS is
// spoken as several chunks, and stepping one chunk would land mid-sentence.
describe('SpeechController skipping', () => {
    beforeEach(() => {
        vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    });

    afterEach(() => {
        speech.stop();
        vi.unstubAllGlobals();
    });

    it('offers skip only inside a live session', () => {
        const { synth } = scriptedSynth();
        installSynth(synth);

        expect(speech.canSkipBack).toBe(false);
        expect(speech.canSkipForward).toBe(false);

        play();

        expect(speech.canSkipBack).toBe(true);
        expect(speech.canSkipForward).toBe(true);
    });

    it('speaks the next sentence when skipped forward', () => {
        const { synth, state } = scriptedSynth();
        installSynth(synth);

        play();
        const first = state.spoken[0];
        speech.skipForward();

        expect(state.spoken).toHaveLength(2);
        expect(state.spoken[1]).not.toBe(first);
        expect(state.spoken[1]).toContain('Five six seven eight');
    });

    // Past the last sentence there is nothing to skip to, so this ends the read
    // exactly as letting it play out would.
    it('ends the read when skipped forward past the last sentence', () => {
        const { synth } = scriptedSynth();
        installSynth(synth);

        play();
        speech.skipForward();
        speech.skipForward();
        expect(speech.canSkipForward).toBe(false);

        speech.skipForward();

        expect(speech.isPlaying).toBe(false);
    });

    // The media-player convention: once you are into a sentence, back means
    // "again" rather than "the one before".
    it('restarts the current sentence once well into it', () => {
        const { synth, state } = scriptedSynth();
        installSynth(synth);

        vi.useFakeTimers();
        play();
        speech.skipForward();
        const second = state.spoken[1];

        // Past SENTENCE_RESTART_MS, so this is a restart rather than a step
        // back. The stamp is read from Date.now(), so the clock is what moves.
        vi.advanceTimersByTime(5_000);
        speech.skipBack();

        expect(state.spoken[2]).toBe(second);
        vi.useRealTimers();
    });

    // Only just into it, so back means the sentence before — pressing back
    // immediately after a sentence starts is how you get to the previous one.
    it('steps back a sentence when it has only just begun', () => {
        const { synth, state } = scriptedSynth();
        installSynth(synth);

        play();
        const first = state.spoken[0];
        speech.skipForward();

        speech.skipBack();

        expect(state.spoken[2]).toBe(first);
    });

    // A skip is an explicit "take me there", so it plays rather than landing the
    // writer on a paused engine they have to press play on again.
    it('resumes a paused read', () => {
        const { synth, state } = scriptedSynth();
        installSynth(synth);

        play();
        speech.pause();
        const spoken = state.spoken.length;

        speech.skipForward();

        expect(speech.isPaused).toBe(false);
        expect(state.spoken.length).toBeGreaterThan(spoken);
    });

    it('ignores skips when nothing is playing', () => {
        const { synth, state } = scriptedSynth();
        installSynth(synth);

        speech.skipForward();
        speech.skipBack();

        expect(state.spoken).toHaveLength(0);
    });
});

describe('SpeechController teardown', () => {
    beforeEach(() => {
        vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    });

    afterEach(() => {
        speech.stop();
        vi.unstubAllGlobals();
    });

    // Called on editor unmount and on document switch. Audio bleeding across
    // documents means the highlight is targeting a view that no longer exists.
    it('puts the transport back to rest', () => {
        const { synth } = scriptedSynth();
        installSynth(synth);

        play();
        speech.stop();

        expect({
            isPlaying: speech.isPlaying,
            isPaused: speech.isPaused,
            canSkipBack: speech.canSkipBack,
            canSkipForward: speech.canSkipForward
        }).toEqual({
            isPlaying: false,
            isPaused: false,
            canSkipBack: false,
            canSkipForward: false
        });
    });

    // cancel() fires `onend` on the utterance it cancels. With the handlers still
    // attached that re-enters #advance() and speaks the next chunk into a session
    // that has just been torn down.
    it('cannot be re-entered by the cancelled utterance', () => {
        const { synth, state, finishChunk } = scriptedSynth();
        installSynth(synth);

        play();
        const spoken = state.spoken.length;
        speech.stop();

        // The engine's late `end`, arriving after the session is over.
        finishChunk();

        expect(state.spoken).toHaveLength(spoken);
        expect(speech.isPlaying).toBe(false);
    });

    it('starts no session on a passage with nothing to say', () => {
        const { synth, state } = scriptedSynth();
        installSynth(synth);

        const editor = fakeEditor();
        editor.state.doc.nodesBetween = (
            _from: number,
            _to: number,
            fn: (node: unknown, pos: number) => boolean
        ) => {
            fn({ isText: true, text: '   \n  ', isBlock: false }, 1);
        };

        play(editor);

        expect(state.spoken).toHaveLength(0);
        expect(speech.isPlaying).toBe(false);
    });

    // A second read has to start clean rather than inheriting the last one's
    // position — an engine left paused swallows every later speak() silently.
    it('starts a fresh read after a stop', () => {
        const { synth, state } = scriptedSynth();
        installSynth(synth);

        play();
        speech.skipForward();
        speech.stop();

        play();

        expect(state.spoken[state.spoken.length - 1]).toContain(
            'One two three four'
        );
        expect(speech.isPlaying).toBe(true);
    });
});

// Word highlight comes only from the engine's own boundary events — Windows and
// macOS emit them, Linux and every network voice do not. Nothing is estimated:
// a wrong highlight is worse than none, which is why the arithmetic turning an
// engine's character offset into a document position is worth asserting rather
// than merely surviving.
//
// The highlight itself is a ProseMirror decoration, so what the controller emits
// is watched at `setTtsHighlight` — the one funnel every highlight change goes
// through.
describe('SpeechController word boundaries', () => {
    beforeEach(() => {
        vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
        vi.mocked(setTtsHighlight).mockClear();
    });

    afterEach(() => {
        speech.stop();
        vi.unstubAllGlobals();
    });

    // The last highlight the controller asked for.
    const lastHighlight = (): TtsHighlight | null => {
        const calls = vi.mocked(setTtsHighlight).mock.calls;
        return calls[calls.length - 1]?.[1] ?? null;
    };

    // Sentence highlight lands from the chunk itself the moment it starts — no
    // boundary event needed, which is what makes it exact on every platform.
    it('bands the sentence as soon as the chunk starts', () => {
        const { synth } = scriptedSynth();
        installSynth(synth);

        play();

        expect(lastHighlight()?.sentence).not.toBeNull();
        // Nothing has reported a word yet, and none is guessed at.
        expect(lastHighlight()?.word).toBeNull();
    });

    it('lights the exact word the engine reports', () => {
        const { synth, boundary } = scriptedSynth();
        installSynth(synth);

        play();
        // 'three' — the third word of 'One two three four.'
        boundary({ name: 'word', charIndex: 8, charLength: 5 });

        const word = lastHighlight()?.word;
        // Document positions, so one past the character offsets: the fake
        // editor's text node starts at 1.
        expect(word).toEqual({ from: 9, to: 14 });
    });

    // Some engines report a boundary with no charLength at all; the word is then
    // taken as far as the next whitespace rather than guessed at.
    it('extends to the next space when no length is reported', () => {
        const { synth, boundary } = scriptedSynth();
        installSynth(synth);

        play();
        boundary({ name: 'word', charIndex: 8, charLength: 0 });

        // The same five characters as above, worked out rather than given.
        expect(lastHighlight()?.word).toEqual({ from: 9, to: 14 });
    });

    // The sentence is exact from the chunk, so a sentence-named boundary carries
    // nothing the controller does not already have — and acting on it would move
    // the word highlight to the start of the sentence.
    it('ignores a sentence boundary', () => {
        const { synth, boundary } = scriptedSynth();
        installSynth(synth);

        play();
        boundary({ name: 'word', charIndex: 8, charLength: 5 });
        const before = lastHighlight();

        boundary({ name: 'sentence', charIndex: 0, charLength: 3 });

        expect(lastHighlight()).toBe(before);
    });

    // A chunk never straddles a sentence, so the band stays put while the word
    // moves within it.
    it('keeps the sentence band while the word moves', () => {
        const { synth, boundary } = scriptedSynth();
        installSynth(synth);

        play();
        boundary({ name: 'word', charIndex: 0, charLength: 3 });
        const sentence = lastHighlight()?.sentence;

        boundary({ name: 'word', charIndex: 8, charLength: 5 });

        expect(lastHighlight()?.sentence).toEqual(sentence);
    });
});
