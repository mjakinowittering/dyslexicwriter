import * as opfs from '../../support/opfs';
import { beforeEach, describe, expect, it } from 'vitest';

import { readConfig, updateConfig, writeConfig } from '$lib/fs/config';
import {
    CONFIG_FILE_NAME,
    CONFIG_VERSION,
    defaultConfig
} from '$lib/models/config.model';

// config.json is the only settings store in the app, and it sits in the user's own
// folder where anything can happen to it — hand-edited, truncated, written by a
// different version. These run against real OPFS handles so the read path is
// exercised as the app runs it: a bad file must cost the user a setting, never
// their way into the app.

let root: FileSystemDirectoryHandle;

const readRaw = () => opfs.readFile(root, '', CONFIG_FILE_NAME);
const writeRaw = (text: string) =>
    opfs.writeRaw(root, '', CONFIG_FILE_NAME, text);

beforeEach(async () => {
    root = await opfs.emptyRoot();
});

describe('readConfig', () => {
    it('falls back to the shipped defaults on first run', async () => {
        // No config.json at all — the folder the user has just chosen.
        expect(await readConfig(root)).toEqual(defaultConfig());
    });

    it('falls back to defaults rather than throwing on unparseable JSON', async () => {
        await writeRaw('{ "theme": "dark"');

        expect(await readConfig(root)).toEqual(defaultConfig());
    });

    it('falls back to defaults when the file holds something that is not an object', async () => {
        await writeRaw('"just a string"');

        expect(await readConfig(root)).toEqual(defaultConfig());
    });

    it('reads a valid file back exactly as written', async () => {
        const config = {
            ...defaultConfig(),
            theme: 'dark' as const,
            font: 'sans' as const,
            tts: { voiceUri: 'urn:voice:alice', rate: 1.4 }
        };
        await writeConfig(root, config);

        expect(await readConfig(root)).toEqual(config);
    });

    // The index used to live here. Anything still carrying one is a file written
    // by an older version, and it must not reach the caller.
    it('ignores a document index left by an older version', async () => {
        await writeRaw(
            JSON.stringify({
                ...defaultConfig(),
                documents: [{ title: 'One' }]
            })
        );

        expect(await readConfig(root)).toEqual(defaultConfig());
    });

    it('costs the user only the setting they broke', async () => {
        // A hand-edited font, with everything around it still good.
        await writeRaw(
            JSON.stringify({
                ...defaultConfig(),
                theme: 'dark',
                font: 'comic sans'
            })
        );

        const config = await readConfig(root);
        expect(config.font).toBe(defaultConfig().font);
        expect(config.theme).toBe('dark');
    });
});

describe('writeConfig', () => {
    it('writes indented JSON with a trailing newline, so the file stays hand-editable', async () => {
        await writeConfig(root, defaultConfig());

        const text = await readRaw();
        expect(text).toBe(`${JSON.stringify(defaultConfig(), null, 2)}\n`);
    });

    it('overwrites cleanly rather than appending', async () => {
        await writeConfig(root, { ...defaultConfig(), theme: 'dark' });
        await writeConfig(root, { ...defaultConfig(), theme: 'light' });

        expect(JSON.parse(await readRaw())).toEqual({
            ...defaultConfig(),
            theme: 'light'
        });
    });
});

describe('updateConfig', () => {
    it('creates the file from defaults when there is none yet', async () => {
        const config = await updateConfig(root, { theme: 'dark' });

        expect(config).toEqual({ ...defaultConfig(), theme: 'dark' });
        expect(JSON.parse(await readRaw())).toEqual(config);
    });

    it('changes one setting and leaves the others alone', async () => {
        await writeConfig(root, {
            ...defaultConfig(),
            font: 'sans',
            tts: { voiceUri: 'urn:voice:alice', rate: 1.4 }
        });

        const config = await updateConfig(root, { theme: 'dark' });

        expect(config.theme).toBe('dark');
        expect(config.font).toBe('sans');
        expect(config.tts).toEqual({ voiceUri: 'urn:voice:alice', rate: 1.4 });
        expect(config.version).toBe(CONFIG_VERSION);
    });

    // A config.json written before the index was dropped still has one on disk.
    // The next write clears it out, and the preferences beside it come through
    // untouched — a stale cache must never cost the user a setting.
    it('clears a document index left by an older version', async () => {
        await writeRaw(
            JSON.stringify({
                ...defaultConfig(),
                font: 'sans',
                documents: [
                    {
                        title: 'One',
                        folder: 'Book/Chapters',
                        file: 'One.md',
                        ownsFolder: false,
                        lastModified: 1_700_000_000_000
                    }
                ]
            })
        );

        const config = await updateConfig(root, { theme: 'dark' });

        expect(config.font).toBe('sans');
        expect(JSON.parse(await readRaw())).not.toHaveProperty('documents');
    });

    it('reads the file rather than the caller when merging, so a hand edit is not clobbered', async () => {
        // The user edited config.json under the app: the patch must land on what
        // is on disk now, not on whatever the app last held.
        await writeRaw(
            JSON.stringify({ ...defaultConfig(), font: 'sans', theme: 'dark' })
        );

        const config = await updateConfig(root, {
            tts: { voiceUri: null, rate: 1.2 }
        });

        expect(config.font).toBe('sans');
        expect(config.theme).toBe('dark');
        expect(config.tts.rate).toBe(1.2);
    });
});
