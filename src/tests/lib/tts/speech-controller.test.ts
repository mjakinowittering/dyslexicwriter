import { describe, expect, it } from 'vitest';

import { pickDefaultVoice } from '$lib/tts/speech-controller.svelte';

// Which voice the app suggests is not cosmetic: word highlighting comes solely
// from the engine's `boundary` events, and a network voice emits none. Picking one
// of those by default silently costs the writer the finer half of the reading
// highlight, which is the bug these cases exist to keep fixed.
//
// `SpeechSynthesisVoice` is a browser interface with no constructor, so a literal
// of the same shape is the only way to name one. Deliberately local rather than
// reusing the Storybook fake: that module pulls in `storybook/test`, which has no
// business in the node suite.
function voice(
    name: string,
    localService: boolean,
    lang = 'en-GB'
): SpeechSynthesisVoice {
    return { default: false, lang, localService, name, voiceURI: name };
}

describe('pickDefaultVoice', () => {
    it('returns null when the engine reports no voices', () => {
        expect(pickDefaultVoice([])).toBeNull();
    });

    it('prefers an on-device voice over a better-named network one', () => {
        // The network voice matches the name preference and comes first; being
        // on-device has to outrank both, or word highlighting never happens.
        const picked = pickDefaultVoice([
            voice('Google UK English Female', false),
            voice('Daniel', true)
        ]);

        expect(picked?.name).toBe('Daniel');
    });

    it('applies the name preference within the on-device voices', () => {
        const picked = pickDefaultVoice([
            voice('Daniel', true),
            voice('Serena', true),
            voice('Google UK English Female', false)
        ]);

        expect(picked?.name).toBe('Serena');
    });

    it('prefers English among the on-device voices', () => {
        const picked = pickDefaultVoice([
            voice('Amelie', true, 'fr-FR'),
            voice('Daniel', true, 'en-GB')
        ]);

        expect(picked?.name).toBe('Daniel');
    });

    it('does not reach past an on-device voice for an English network one', () => {
        // Each narrowing is skipped rather than allowed to empty the pool, so
        // "on-device" is not quietly traded away to satisfy "English".
        const picked = pickDefaultVoice([
            voice('Amelie', true, 'fr-FR'),
            voice('Google US English', false, 'en-US')
        ]);

        expect(picked?.name).toBe('Amelie');
    });

    it('falls back to a network voice when the device has none of its own', () => {
        // Reading aloud without word highlighting still beats not reading aloud.
        const picked = pickDefaultVoice([
            voice('Google US English', false, 'en-US'),
            voice('Google UK English Female', false)
        ]);

        expect(picked?.name).toBe('Google UK English Female');
    });

    it('takes the first voice when nothing matches a preference', () => {
        const picked = pickDefaultVoice([
            voice('Amelie', true, 'fr-FR'),
            voice('Bruno', true, 'pt-BR')
        ]);

        expect(picked?.name).toBe('Amelie');
    });
});
