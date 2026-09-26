import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReadAloudBar } from '$lib/tts/read-aloud-bar.svelte';

// When the floating read-aloud bar is showing. Opened from the toolbar, it has
// to stay open until a read that starts in it ends — however it ends — and
// must not vanish under the writer before they have read anything.

// Just enough transport for the bar: a playback state a test can move, and a
// stop that ends it the way the real controller does.
function fakeTransport() {
    const state = $state({ isPlaying: false, isPaused: false });
    const stop = vi.fn((): void => {
        state.isPlaying = false;
        state.isPaused = false;
    });
    const transport = {
        get isPlaying(): boolean {
            return state.isPlaying;
        },
        stop
    };
    return { state, stop, transport };
}

let cleanup: (() => void) | undefined;

afterEach(() => {
    cleanup?.();
    cleanup = undefined;
});

function mount() {
    const fake = fakeTransport();
    let bar: ReadAloudBar | undefined;
    cleanup = $effect.root(() => {
        bar = new ReadAloudBar(fake.transport);
    });
    flushSync();
    if (!bar) throw new Error('ReadAloudBar was not built');
    return { ...fake, bar };
}

describe('ReadAloudBar', () => {
    it('starts closed, and opens without starting a read', () => {
        const { bar, state } = mount();
        expect(bar.open).toBe(false);

        bar.launch();

        expect(bar.open).toBe(true);
        expect(state.isPlaying).toBe(false);
    });

    it('stays open through a read and a pause', () => {
        const { bar, state } = mount();
        bar.launch();

        state.isPlaying = true;
        flushSync();
        expect(bar.open).toBe(true);

        state.isPaused = true;
        flushSync();
        expect(bar.open).toBe(true);
    });

    it('closes when the read comes to an end by itself', () => {
        const { bar, state } = mount();
        bar.launch();
        state.isPlaying = true;
        flushSync();

        state.isPlaying = false;
        flushSync();

        expect(bar.open).toBe(false);
    });

    it('closes when anything else stops the read', () => {
        const { bar, state, transport } = mount();
        bar.launch();
        state.isPlaying = true;
        flushSync();

        // The page's own speech.stop() — a document switch, a delete, pagehide.
        transport.stop();
        flushSync();

        expect(bar.open).toBe(false);
    });

    it('closes from idle, and stops the transport as it goes', () => {
        const { bar, stop } = mount();
        bar.launch();

        bar.close();

        expect(bar.open).toBe(false);
        expect(stop).toHaveBeenCalledOnce();
    });

    // Play on an empty document never gets a read going: the bar must not
    // vanish under the writer for pressing it.
    it('stays open when Play never gets a read going', () => {
        const { bar } = mount();
        bar.launch();
        flushSync();

        expect(bar.open).toBe(true);
    });
});
