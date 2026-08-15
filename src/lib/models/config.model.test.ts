import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import shippedDefaults from '$lib/config/defaults.json';

import {
    CONFIG_VERSION,
    defaultConfig,
    defaultPreferences,
    parseConfig,
    preferencesSchema
} from './config.model';

describe('defaults.json', () => {
    // It is a file like any other, so a typo in it must fail here rather than
    // silently degrading to the in-code fallbacks at runtime.
    it('validates against the preferences schema', () => {
        expect(v.safeParse(preferencesSchema, shippedDefaults).success).toBe(
            true
        );
    });

    it('is the source of the shipped first-run preferences', () => {
        expect(defaultPreferences()).toEqual(shippedDefaults);
    });

    it('ships OpenDyslexic as the default font', () => {
        expect(defaultConfig().font).toBe('dyslexic');
    });

    // version and documents are structural, owned by the code — a default for
    // them has no meaning and must not creep into the file.
    it('holds preferences only', () => {
        expect(Object.keys(shippedDefaults).sort()).toEqual([
            'font',
            'theme',
            'tts'
        ]);
    });
});

describe('defaultConfig', () => {
    it('seeds a fresh config from the shipped defaults', () => {
        expect(defaultConfig()).toEqual({
            version: CONFIG_VERSION,
            ...shippedDefaults,
            documents: []
        });
    });

    it('hands out a fresh documents array each call', () => {
        const first = defaultConfig();
        first.documents.push({
            title: 'Draft',
            folder: 'Draft',
            file: 'Draft.md',
            lastModified: 0
        });
        expect(defaultConfig().documents).toEqual([]);
    });
});

describe('parseConfig', () => {
    const saved = {
        version: CONFIG_VERSION,
        theme: 'dark',
        font: 'sans',
        tts: { voiceUri: 'urn:moz-tts:sapi:Zira', rate: 1.4 },
        documents: [
            {
                title: 'My Chapter',
                folder: 'My Chapter',
                file: 'My Chapter.md',
                lastModified: 1
            }
        ]
    };

    it('returns a valid config unchanged', () => {
        expect(parseConfig(saved)).toEqual(saved);
    });

    // The whole point of parsing per key: a hand-edited mistake in one setting
    // must not throw away every other preference the user has chosen.
    it('keeps the sibling preferences when one is invalid', () => {
        const parsed = parseConfig({ ...saved, theme: 'aubergine' });

        expect(parsed.theme).toBe(defaultConfig().theme);
        expect(parsed.font).toBe('sans');
        expect(parsed.tts).toEqual(saved.tts);
        expect(parsed.documents).toEqual(saved.documents);
    });

    it('keeps the chosen voice when the rate is out of range', () => {
        const parsed = parseConfig({
            ...saved,
            tts: { voiceUri: 'urn:moz-tts:sapi:Zira', rate: 9 }
        });

        expect(parsed.tts.voiceUri).toBe('urn:moz-tts:sapi:Zira');
        expect(parsed.tts.rate).toBe(defaultConfig().tts.rate);
    });

    it('replaces a malformed document index without touching preferences', () => {
        const parsed = parseConfig({ ...saved, documents: 'not an array' });

        expect(parsed.documents).toEqual([]);
        expect(parsed.theme).toBe('dark');
    });

    it('falls back to defaults for a missing key', () => {
        const { font, ...withoutFont } = saved;
        expect(font).toBe('sans');
        expect(parseConfig(withoutFont).font).toBe(defaultConfig().font);
    });

    it.each([null, undefined, 'a string', 42, ['an', 'array']])(
        'falls back entirely for a non-object input (%p)',
        (input) => {
            expect(parseConfig(input)).toEqual(defaultConfig());
        }
    );
});
