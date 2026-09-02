import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { speech } from '$lib/tts/speech-controller.svelte';

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

describe('SpeechController pause', () => {
    // The real SpeechSynthesisUtterance refuses a voice it did not mint, and the
    // stand-in engine below deals only in stand-ins.
    class FakeUtterance {
        text: string;
        voice: unknown = null;
        rate = 1;
        onstart: (() => void) | null = null;
        onboundary: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
            this.text = text;
        }
    }

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

    // The bits of a TipTap editor the controller touches. A real one would need a
    // mounted view; nothing under test here reads the document beyond its text.
    function fakeEditor() {
        const text =
            'One two three four. Five six seven eight. Nine ten eleven twelve.';
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

    it('does not speak the next sentence into a paused engine', () => {
        const { synth, state } = pausingSynth();
        installSynth(synth);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a stand-in for the parts of Editor the controller reads
        speech.play(fakeEditor() as any);
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as above
        speech.play(fakeEditor() as any);
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as above
        speech.play(fakeEditor() as any);
        speech.pause();
        const spoken = state.spoken.length;
        speech.pause();

        expect(state.spoken).toHaveLength(spoken);

        speech.resume();
        expect(state.spoken.length).toBeGreaterThan(spoken);

        speech.stop();
    });
});
