import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
    configSchema,
    defaultConfig,
    parseConfig
} from '$lib/models/config.model';
import {
    TTS_RATE_MAX,
    TTS_RATE_MIN,
    ttsPreferencesSchema
} from '$lib/models/tts.model';

describe('ttsPreferencesSchema', () => {
    it('accepts a valid preference object', () => {
        expect(
            v.safeParse(ttsPreferencesSchema, {
                voiceUri: 'urn:moz-tts:sapi:Zira',
                rate: 1.2
            }).success
        ).toBe(true);
    });

    it('accepts a null voice (use the suggested default)', () => {
        expect(
            v.safeParse(ttsPreferencesSchema, { voiceUri: null, rate: 1 })
                .success
        ).toBe(true);
    });

    it('accepts the rate bounds but rejects values outside them', () => {
        expect(
            v.safeParse(ttsPreferencesSchema, {
                voiceUri: null,
                rate: TTS_RATE_MIN
            }).success
        ).toBe(true);
        expect(
            v.safeParse(ttsPreferencesSchema, {
                voiceUri: null,
                rate: TTS_RATE_MAX
            }).success
        ).toBe(true);
        expect(
            v.safeParse(ttsPreferencesSchema, {
                voiceUri: null,
                rate: TTS_RATE_MAX + 0.5
            }).success
        ).toBe(false);
        expect(
            v.safeParse(ttsPreferencesSchema, {
                voiceUri: null,
                rate: 0
            }).success
        ).toBe(false);
    });

    it('rejects an over-long voiceUri', () => {
        expect(
            v.safeParse(ttsPreferencesSchema, {
                voiceUri: 'x'.repeat(256),
                rate: 1
            }).success
        ).toBe(false);
    });
});

describe('configSchema — tts preferences on disk', () => {
    it('accepts a config carrying valid tts preferences', () => {
        expect(
            v.safeParse(configSchema, {
                ...defaultConfig(),
                tts: { voiceUri: null, rate: 1.5 }
            }).success
        ).toBe(true);
    });

    it('rejects a config with an out-of-range rate', () => {
        expect(
            v.safeParse(configSchema, {
                ...defaultConfig(),
                tts: { voiceUri: null, rate: 9 }
            }).success
        ).toBe(false);
    });

    // config.json is hand-editable, so a bad rate must degrade to defaults rather
    // than throw — the user's writing must stay reachable.
    it('falls back to defaults rather than throwing on an invalid rate', () => {
        const parsed = parseConfig({
            ...defaultConfig(),
            tts: { voiceUri: null, rate: 9 }
        });
        expect(parsed.tts.rate).toBe(defaultConfig().tts.rate);
    });
});
