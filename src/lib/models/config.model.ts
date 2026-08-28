import * as v from 'valibot';

import shippedDefaults from '$lib/config/defaults.json';

import {
    TTS_DEFAULT_RATE,
    ttsPreferencesSchema,
    type TtsPreferences
} from './tts.model';

// The shape of `config.json`, the single settings file in the user's working
// folder. It holds every persisted preference plus the document index, so moving
// the folder to another machine brings settings and the Files screen along.
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

// The longest path the scan will index. Deep enough for a real writing tree, short
// enough that a hand-edited entry can't grow unbounded.
const PATH_MAX_LENGTH = 1024;

export const documentIndexEntrySchema = v.object({
    // Display title: the markdown file's basename, without the extension.
    title: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
    // The containing directory as a '/'-joined path relative to the working
    // folder. '' is the working folder itself, where a loose `notes.md` lives.
    folder: v.pipe(v.string(), v.maxLength(PATH_MAX_LENGTH)),
    // File name within that folder, including the .md extension.
    file: v.pipe(v.string(), v.minLength(1), v.maxLength(130)),
    // True when this document owns its folder — the `My Chapter/My Chapter.md`
    // shape the app creates, where renaming moves the folder and deleting removes
    // it whole. False for a markdown file the app merely found sitting among
    // others. Optional so an index written by an older version still parses; it is
    // recomputed by every scan and never trusted from the cache.
    ownsFolder: v.optional(v.boolean(), false),
    // Epoch milliseconds, shown against each document on the Files screen.
    lastModified: v.pipe(v.number(), v.minValue(0))
});

const documentsSchema = v.array(documentIndexEntrySchema);

// The preferences the user can actually set — everything in `config.json` that
// has a first-run value in `src/lib/config/defaults.json`. `version` and
// `documents` are structural rather than configurable, so they are owned by the
// code and stay out of this.
export const preferencesSchema = v.object({
    theme: themeSchema,
    font: fontSchema,
    tts: ttsPreferencesSchema
});

export const configSchema = v.object({
    version: versionSchema,
    ...preferencesSchema.entries,
    // A cache for the Files screen, not an authority — a folder scan reconciles it
    // whenever the two disagree.
    documents: documentsSchema
});

export type Theme = v.InferOutput<typeof configSchema>['theme'];
export type Font = v.InferOutput<typeof configSchema>['font'];
export type DocumentIndexEntry = v.InferOutput<typeof documentIndexEntrySchema>;
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
        ...defaultPreferences(),
        documents: []
    };
}

// Parse an unknown value (typically JSON.parse of the file) into a Config,
// falling back to defaults rather than throwing. A corrupt settings file must
// never stop the user reaching their writing.
//
// Deliberately per key rather than one `safeParse` of the whole object: a single
// hand-edited mistake should cost the user that one setting, not every other
// preference they have ever chosen.
export function parseConfig(input: unknown): Config {
    const base = defaultConfig();
    const raw = asRecord(input);
    if (!raw) return base;

    return {
        version: pick(versionSchema, raw.version, base.version),
        ...layerPreferences(raw, base),
        // The index is a cache the folder scan rebuilds, so there is nothing to
        // salvage from a malformed one — take it whole or not at all.
        documents: pick(documentsSchema, raw.documents, base.documents)
    };
}
