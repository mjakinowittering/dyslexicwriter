import * as v from 'valibot';

// Read-aloud (text-to-speech) tuning. Bounds are shared by the model, the stored
// `config.json` shape, and the voice-settings UI so the slider can never emit a
// rate that fails validation on the way back in from disk.
// The floor is 0.75 rather than 0.5 because of what the browser does below it, not
// because of taste: an utterance slow enough to run past Chrome's ~15s cutoff gets
// truncated mid-sentence, and MAX_CHUNK_CHARS is sized against this value. A stored
// 0.5 from an older config.json now fails validation and falls back to the default
// rate — one setting, per the key-by-key parse in config.model.ts.
export const TTS_RATE_MIN = 0.75;
export const TTS_RATE_MAX = 2;
export const TTS_DEFAULT_RATE = 1;

export const ttsPreferencesSchema = v.object({
    // A `SpeechSynthesisVoice.voiceURI`. Device-specific — the set of installed
    // voices differs per machine/browser — so this is resolved by identity at
    // runtime and falls back to the default heuristic when absent on this device.
    // Null = "use the suggested default voice" (also the reset-to-defaults state).
    voiceUri: v.nullable(v.pipe(v.string(), v.maxLength(255))),
    rate: v.pipe(v.number(), v.minValue(TTS_RATE_MIN), v.maxValue(TTS_RATE_MAX))
});

export type TtsPreferences = v.InferOutput<typeof ttsPreferencesSchema>;
