import { fn } from 'storybook/test';

import type { Font, Theme } from '$lib/models/config.model';
import { defaultPreferences } from '$lib/models/config.model';
import type { TtsPreferences } from '$lib/models/tts.model';
import type { PreferenceStore } from '$lib/stores/workspace.svelte';
import type { TtsTransport } from '$lib/tts/speech-controller.svelte';

// Stand-ins for the app's two singletons, for stories only — nothing here ships.
//
// They exist because the real ones can't be posed: the speech controller's skip
// getters read private playback fields, and every workspace setter writes
// config.json to a folder the browser doesn't have in a story. Both fakes are
// $state-backed, so a `play` function can drive them and watch the UI follow, and
// every method is a spy so a play can assert the click reached it.

// A voice list entry. `SpeechSynthesisVoice` is a browser interface with no
// constructor, so a literal of the same shape is the only way to name one.
export function fakeVoice(
    name: string,
    lang = 'en-GB',
    voiceURI = name
): SpeechSynthesisVoice {
    return { default: false, lang, localService: true, name, voiceURI };
}

export const FAKE_VOICES: SpeechSynthesisVoice[] = [
    fakeVoice('Serena'),
    fakeVoice('Daniel'),
    fakeVoice('Karen', 'en-AU')
];

type TtsOverrides = Partial<
    Pick<
        TtsTransport,
        | 'isPlaying'
        | 'isPaused'
        | 'canSkipBack'
        | 'canSkipForward'
        | 'voices'
        | 'voiceUri'
        | 'rate'
    >
>;

class FakeTtsTransport implements TtsTransport {
    isPlaying = $state(false);
    isPaused = $state(false);
    canSkipBack = $state(false);
    canSkipForward = $state(false);
    voices = $state<SpeechSynthesisVoice[]>([]);
    voiceUri = $state<string | null>(null);
    rate = $state(defaultPreferences().tts.rate);

    captureSelection = fn().mockName('captureSelection');
    toggle = fn().mockName('toggle');
    stop = fn().mockName('stop');
    skipBack = fn().mockName('skipBack');
    skipForward = fn().mockName('skipForward');
    resetToDefaults = fn().mockName('resetToDefaults');

    constructor(overrides: TtsOverrides = {}) {
        Object.assign(this, overrides);
    }

    get preferences(): TtsPreferences {
        return { voiceUri: this.voiceUri, rate: this.rate };
    }
}

// A transport in whatever state the story needs: `makeTts({ isPlaying: true })`.
export function makeTts(overrides: TtsOverrides = {}): FakeTtsTransport {
    return new FakeTtsTransport(overrides);
}

class FakePreferenceStore implements PreferenceStore {
    theme = $state<Theme>('light');
    font = $state<Font>('sans');

    // The spies write through as the real store does, so a story stays in step
    // with the control the user just moved.
    setTheme = fn(async (theme: Theme): Promise<void> => {
        this.theme = theme;
    }).mockName('setTheme');

    setFont = fn(async (font: Font): Promise<void> => {
        this.font = font;
    }).mockName('setFont');

    constructor(
        overrides: Partial<Pick<PreferenceStore, 'theme' | 'font'>> = {}
    ) {
        Object.assign(this, overrides);
    }
}

export function makePreferences(
    overrides: Partial<Pick<PreferenceStore, 'theme' | 'font'>> = {}
): FakePreferenceStore {
    return new FakePreferenceStore(overrides);
}
