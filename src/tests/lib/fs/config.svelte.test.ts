import * as opfs from '../../support/opfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    loadConfig,
    readConfig,
    refreshConfig,
    updateConfig,
    writeConfig
} from '$lib/fs/config';
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

// A read failure that is NOT the file being absent: permission revoked, drive
// unplugged, a file we cannot open. There is no way to arrange one of those on a
// real OPFS root, so the handle's own read is made to fail instead — the point
// under test is which DOMException name reaches the caller, not how it got there.
function failNextRead(name = 'NotAllowedError'): void {
    vi.spyOn(root, 'getFileHandle').mockRejectedValueOnce(
        new DOMException('the folder is no longer available', name)
    );
}

beforeEach(async () => {
    root = await opfs.emptyRoot();
});

afterEach(() => {
    vi.restoreAllMocks();
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

    // The one distinction this module exists to draw. A folder with no settings
    // file is first run; a settings file we could not read is a file whose real
    // contents we have never seen, and answering with defaults would let the
    // caller write them straight over the user's preferences.
    it('rejects rather than falling back when the read fails for any reason but absence', async () => {
        failNextRead();

        await expect(readConfig(root)).rejects.toThrow(DOMException);
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

// Adopting a folder brings its config.json up to date with the preferences this
// version knows about, so a setting added since the folder was last opened lands
// in the file the user hand-edits rather than living only in memory.
describe('refreshConfig', () => {
    it('creates the file on a folder that has never had one', async () => {
        const config = await refreshConfig(root);

        expect(config).toEqual(defaultConfig());
        expect(JSON.parse(await readRaw())).toEqual(defaultConfig());
    });

    // The reason for the whole change: a folder last opened before a preference
    // existed must gain it, not be stuck without it until something else is saved.
    it('writes in a preference the file does not have yet', async () => {
        const { prettier, ...withoutPrettier } = defaultConfig();
        expect(prettier).toBeDefined();
        await writeRaw(`${JSON.stringify(withoutPrettier, null, 2)}\n`);

        const config = await refreshConfig(root);

        expect(config.prettier).toEqual(prettier);
        expect(JSON.parse(await readRaw()).prettier).toEqual(prettier);
    });

    it('keeps the settings the user had chosen while adding the new one', async () => {
        const { prettier: _prettier, ...withoutPrettier } = defaultConfig();
        await writeRaw(
            `${JSON.stringify({ ...withoutPrettier, font: 'sans', theme: 'light' }, null, 2)}\n`
        );

        const config = await refreshConfig(root);

        expect(config.font).toBe('sans');
        expect(config.theme).toBe('light');
        expect(JSON.parse(await readRaw()).font).toBe('sans');
    });

    it('repairs a value that failed validation', async () => {
        await writeRaw(
            `${JSON.stringify({ ...defaultConfig(), theme: 'aubergine' }, null, 2)}\n`
        );

        await refreshConfig(root);

        expect(JSON.parse(await readRaw()).theme).toBe(defaultConfig().theme);
    });

    it('drops an index left behind by an older version', async () => {
        await writeRaw(
            `${JSON.stringify({ ...defaultConfig(), documents: [{ title: 'Old' }] }, null, 2)}\n`
        );

        await refreshConfig(root);

        expect(await readRaw()).not.toContain('documents');
    });

    // Every launch calls this. Rewriting a file that already says the right thing
    // would move its mtime for nothing.
    it('leaves an up-to-date file untouched', async () => {
        await writeConfig(root, { ...defaultConfig(), font: 'sans' });
        const before = await readRaw();

        const write = vi.spyOn(
            FileSystemFileHandle.prototype,
            'createWritable'
        );
        await refreshConfig(root);

        expect(write).not.toHaveBeenCalled();
        expect(await readRaw()).toBe(before);
    });

    // The one file it must never replace. A broken hand-edit is something the
    // writer was part-way through, and there is no trash behind config.json.
    it('leaves a file it cannot parse exactly as it found it', async () => {
        const broken = '{ "theme": "dark", }';
        await writeRaw(broken);

        const config = await refreshConfig(root);

        expect(config).toEqual(defaultConfig());
        expect(await readRaw()).toBe(broken);
    });

    // Reading threw — a revoked permission, an unplugged drive. Answering with
    // defaults would be indistinguishable from a real read, so it rejects and the
    // caller decides; writing over settings we never saw is the thing to avoid.
    it('rejects rather than writing over settings it could not read', async () => {
        failNextRead();

        await expect(refreshConfig(root)).rejects.toThrow(DOMException);
    });

    // Nothing of the user's is lost when the tidy-up write fails: the config is
    // already correct in memory, and a folder that cannot be written to says so
    // the moment they change a setting.
    it('still returns the settings when the file cannot be written', async () => {
        vi.spyOn(
            FileSystemFileHandle.prototype,
            'createWritable'
        ).mockRejectedValue(new DOMException('read-only', 'NotAllowedError'));

        await expect(refreshConfig(root)).resolves.toEqual(defaultConfig());
    });
});

describe('loadConfig', () => {
    it.each([
        ['no file at all', null, true],
        ['a file missing a preference', '{"theme":"dark"}', true],
        ['a file that is not JSON', '{ nope', false]
    ])('reports %s as outdated=%s', async (_label, raw, outdated) => {
        if (raw !== null) await writeRaw(raw);

        expect((await loadConfig(root)).outdated).toBe(outdated);
    });

    it('reports a file it just wrote as up to date', async () => {
        await writeConfig(root, defaultConfig());

        expect((await loadConfig(root)).outdated).toBe(false);
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

    // The read is the guard: settings that could not be read must survive the
    // attempt untouched, because a file of defaults written over a writer's real
    // preferences is not recoverable and they never asked for any of it.
    it('writes nothing when the file cannot be read', async () => {
        const saved = {
            ...defaultConfig(),
            font: 'sans' as const,
            tts: { voiceUri: 'urn:voice:alice', rate: 1.4 }
        };
        await writeConfig(root, saved);
        const before = await readRaw();

        failNextRead();

        await expect(updateConfig(root, { theme: 'light' })).rejects.toThrow(
            DOMException
        );
        expect(await readRaw()).toBe(before);
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
