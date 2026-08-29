import * as v from 'valibot';

import shippedDefaults from '$lib/config/defaults.json';

import {
    TTS_DEFAULT_RATE,
    ttsPreferencesSchema,
    type TtsPreferences
} from './tts.model';

// The shape of `config.json`, the single settings file in the user's working
// folder. It holds every persisted preference and nothing else, so moving the
// folder to another machine brings the settings along with the writing.
//
// It deliberately does NOT hold a document index. The folder on disk is the only
// source for that list: it is scanned into the workspace store on load and every
// screen renders from there, so a copy here would be written on every save and
// read by nobody.
//
// This file is user-editable and may be hand-edited, truncated, or written by an
// older/newer version of the app, so nothing may be trusted by shape: it is parsed
// through this schema on every read and falls back to defaults when invalid.

export const CONFIG_FILE_NAME = 'config.json';

// Bumped only for a breaking change to the file's shape, so a future version can
// migrate rather than silently discard a user's settings.
export const CONFIG_VERSION = 1;

export const themeValues = ['light', 'dark'] as const;
export const fontValues = ['sans', 'dyslexic'] as const;

const themeSchema = v.picklist(themeValues);
const fontSchema = v.picklist(fontValues);
const versionSchema = v.pipe(v.number(), v.integer());

// The preferences the user can actually set — everything in `config.json` that
// has a first-run value in `src/lib/config/defaults.json`. `version` is
// structural rather than configurable, so it is owned by the code and stays out
// of this.
export const preferencesSchema = v.object({
    theme: themeSchema,
    font: fontSchema,
    tts: ttsPreferencesSchema
});

export const configSchema = v.object({
    version: versionSchema,
    ...preferencesSchema.entries
});

export type Theme = v.InferOutput<typeof configSchema>['theme'];
export type Font = v.InferOutput<typeof configSchema>['font'];
export type Preferences = v.InferOutput<typeof preferencesSchema>;
export type Config = v.InferOutput<typeof configSchema>;

// Last resort if `defaults.json` is itself malformed. It is a file like any
// other, so a typo in it must not propagate into a fresh `config.json` — these
// in-code values mirror the shipped ones and take over per key when it does.
const FALLBACK_PREFERENCES: Preferences = {
    theme: 'light',
    font: 'dyslexic',
    tts: { voiceUri: null, rate: TTS_DEFAULT_RATE }
};

// Parse one value against one schema, falling back rather than throwing. The
// unit of failure is a single key: this is what stops a bad `rate` costing the
// user their theme, font and chosen voice.
function pick<S extends v.GenericSchema>(
    schema: S,
    value: unknown,
    fallback: v.InferOutput<S>
): v.InferOutput<S> {
    const result = v.safeParse(schema, value);
    return result.success ? result.output : fallback;
}

function asRecord(input: unknown): Record<string, unknown> | null {
    return typeof input === 'object' && input !== null && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : null;
}

function layerTts(input: unknown, base: TtsPreferences): TtsPreferences {
    const raw = asRecord(input);
    if (!raw) return base;

    return {
        voiceUri: pick(
            ttsPreferencesSchema.entries.voiceUri,
            raw.voiceUri,
            base.voiceUri
        ),
        rate: pick(ttsPreferencesSchema.entries.rate, raw.rate, base.rate)
    };
}

// Layer one set of preferences over another, key by key. Used twice: to lay the
// shipped `defaults.json` over the in-code fallbacks, and to lay the user's
// saved `config.json` over those defaults.
function layerPreferences(input: unknown, base: Preferences): Preferences {
    const raw = asRecord(input);
    if (!raw) return base;

    return {
        theme: pick(themeSchema, raw.theme, base.theme),
        font: pick(fontSchema, raw.font, base.font),
        tts: layerTts(raw.tts, base.tts)
    };
}

// The shipped first-run preferences, read from `src/lib/config/defaults.json`.
// Change a default there, not here — every preference in `config.json` has a
// sibling in that file.
export function defaultPreferences(): Preferences {
    return layerPreferences(shippedDefaults, FALLBACK_PREFERENCES);
}

export function defaultConfig(): Config {
    return {
        version: CONFIG_VERSION,
        ...defaultPreferences()
    };
}

// Parse an unknown value (typically JSON.parse of the file) into a Config,
// falling back to defaults rather than throwing. A corrupt settings file must
// never stop the user reaching their writing.
//
// Deliberately per key rather than one `safeParse` of the whole object: a single
// hand-edited mistake should cost the user that one setting, not every other
// preference they have ever chosen.
//
// Keys this version does not know are dropped rather than carried through — a
// `documents` index written by an older version costs the user nothing on read,
// and goes for good the next time anything writes the file.
export function parseConfig(input: unknown): Config {
    const base = defaultConfig();
    const raw = asRecord(input);
    if (!raw) return base;

    return {
        version: pick(versionSchema, raw.version, base.version),
        ...layerPreferences(raw, base)
    };
}
