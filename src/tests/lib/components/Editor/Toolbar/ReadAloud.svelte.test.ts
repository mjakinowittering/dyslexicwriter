import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import type { TtsPreferences } from '$lib/models/tts.model';
import type { TtsTransport } from '$lib/tts/speech-controller.svelte';

import ReadAloudHarness from './ReadAloudHarness.svelte';

// The toolbar's Read aloud button and the floating bar it opens. Opening must
// start nothing and put the writer on Play; Stop must put the bar away even
// before anything was read, and hand focus back to the button that opened it —
// the focused Stop button goes with the bar.
//
// Clicks are dispatched as DOM events rather than driven through Playwright
// (see ToolbarLocation's suite).

class FakeTransport implements TtsTransport {
    isPlaying = $state(false);
    isPaused = $state(false);
    canSkipBack = false;
    canSkipForward = false;
    voices: SpeechSynthesisVoice[] = [];
    voiceUri: string | null = null;
    rate = 1;
    captureSelection = vi.fn();
    toggle = vi.fn();
    stop = vi.fn((): void => {
        this.isPlaying = false;
        this.isPaused = false;
    });
    skipBack = vi.fn();
    skipForward = vi.fn();
    resetToDefaults = vi.fn();

    get preferences(): TtsPreferences {
        return { voiceUri: this.voiceUri, rate: this.rate };
    }
}

async function mount() {
    const controller = new FakeTransport();
    await render(ReadAloudHarness, { controller });
    const launcher = page.getByRole('button', { name: 'Read aloud' });
    const bar = page.getByRole('toolbar', { name: 'Read-aloud controls' });
    const click = (target: typeof launcher) =>
        (target.element() as HTMLElement).click();
    return { controller, launcher, bar, click };
}

describe('Read aloud', () => {
    it('opens the bar on Play without starting a read', async () => {
        const { controller, launcher, bar, click } = await mount();
        await expect.element(launcher).toHaveAttribute('aria-pressed', 'false');
        await expect.element(bar).not.toBeInTheDocument();

        click(launcher);

        await expect.element(bar).toBeInTheDocument();
        await expect.element(launcher).toHaveAttribute('aria-pressed', 'true');
        await expect
            .element(bar.getByRole('button', { name: 'Play' }))
            .toHaveFocus();
        expect(controller.toggle).not.toHaveBeenCalled();
    });

    it('puts the bar away with Stop from idle, focus back on the button', async () => {
        const { controller, launcher, bar, click } = await mount();
        click(launcher);
        await expect.element(bar).toBeInTheDocument();

        click(bar.getByRole('button', { name: 'Stop reading' }));

        await expect.element(bar).not.toBeInTheDocument();
        await expect.element(launcher).toHaveAttribute('aria-pressed', 'false');
        await expect.element(launcher).toHaveFocus();
        expect(controller.stop).toHaveBeenCalled();
    });

    it('closes when a read ends by itself, and stays through a pause', async () => {
        const { controller, launcher, bar, click } = await mount();
        click(launcher);
        controller.isPlaying = true;
        controller.isPaused = true;
        await expect.element(bar).toBeInTheDocument();

        controller.isPlaying = false;
        controller.isPaused = false;

        await expect.element(bar).not.toBeInTheDocument();
        await expect.element(launcher).toHaveAttribute('aria-pressed', 'false');
    });

    it('stops a read and closes the bar when the button is pressed again', async () => {
        const { controller, launcher, bar, click } = await mount();
        click(launcher);
        controller.isPlaying = true;
        await expect.element(bar).toBeInTheDocument();

        click(launcher);

        await expect.element(bar).not.toBeInTheDocument();
        expect(controller.stop).toHaveBeenCalled();
    });
});
