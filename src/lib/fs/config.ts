import {
    CONFIG_FILE_NAME,
    defaultConfig,
    parseConfig,
    type Config
} from '$lib/models/config.model';

import { isNotFoundError, writeFile } from './io';

// Read and write `config.json` in the root of the user's working folder.
//
// This is the only settings store in the app. Because it lives in the user's own
// folder rather than in browser storage, moving that folder to another machine or
// browser brings the preferences along with the writing.

export interface LoadedConfig {
    config: Config;

    // Whether the file on disk should be brought up to date with `config`.
    //
    // True when there is no file yet, and when what it holds is not what this
    // version would write: a preference added since it was last saved, a value
    // that failed validation and fell back, an index key an older version left
    // behind. That is the whole point — a setting the app has learned about
    // appears in the file the user hand-edits, rather than only in memory.
    //
    // Deliberately FALSE for a file that exists and cannot be parsed at all.
    // That is somebody's hand-edit caught mid-mistake, and replacing it with
    // defaults would throw away whatever they were part-way through typing —
    // with no trash behind it, and without their having asked for anything.
    outdated: boolean;
}

// Exactly what `writeConfig` puts on disk. One definition, because the staleness
// check below compares against it: if the file already reads this way there is
// nothing to bring up to date, and a launch that rewrote an identical file would
// move its mtime for nothing.
function serialiseConfig(config: Config): string {
    return `${JSON.stringify(config, null, 2)}\n`;
}

export async function loadConfig(
    root: FileSystemDirectoryHandle
): Promise<LoadedConfig> {
    let text: string;

    try {
        const handle = await root.getFileHandle(CONFIG_FILE_NAME);
        text = await (await handle.getFile()).text();
    } catch (cause) {
        // First run: nothing has written settings here yet. Narrow on purpose —
        // every other failure (a permission we no longer have, an unplugged
        // drive) is a settings file we could not READ rather than one that is
        // not THERE, and the difference decides whether the next preference the
        // user changes gets written over settings sitting on disk intact.
        if (isNotFoundError(cause)) {
            return { config: defaultConfig(), outdated: true };
        }
        // Anything else, and we do not know what this file holds. Let it out
        // rather than answering with defaults the caller cannot tell apart from
        // a real read — see `updateConfig` for what that protects.
        throw cause;
    }

    let raw: unknown;

    try {
        raw = JSON.parse(text);
    } catch {
        // The file read fine and holds something that is not JSON at all — a
        // hand edit that got away. parseConfig covers every malformed value
        // inside a valid object; this covers the object itself. Defaults in
        // memory so the user still reaches their documents, and the file left
        // exactly as it is: see `outdated` for why this one is not rewritten.
        return { config: defaultConfig(), outdated: false };
    }

    // parseConfig validates and falls back to defaults key by key; a hand-edited
    // value must never stop the user reaching their documents.
    const config = parseConfig(raw);

    return { config, outdated: serialiseConfig(config) !== text };
}

export async function readConfig(
    root: FileSystemDirectoryHandle
): Promise<Config> {
    return (await loadConfig(root)).config;
}

// Load the settings, and bring the file up to date with them when it has fallen
// behind — a preference this version knows about and the file does not is written
// in, so the user editing `config.json` by hand sees every setting there is.
//
// The write is best-effort on purpose. The config it returns is already correct
// in memory, nothing of the user's is lost by the file staying as it was, and a
// folder that cannot be written to says so the moment they change a setting. A
// failure to tidy a settings file is not worth an error in front of a writer.
export async function refreshConfig(
    root: FileSystemDirectoryHandle
): Promise<Config> {
    const { config, outdated } = await loadConfig(root);
    if (!outdated) return config;

    try {
        await writeConfig(root, config);
    } catch {
        // Deliberately swallowed — see above.
    }

    return config;
}

export async function writeConfig(
    root: FileSystemDirectoryHandle,
    config: Config
): Promise<void> {
    // Serialised before the writable is opened, which is what `writeFile`
    // requires: opening one truncates the file.
    await writeFile(root, CONFIG_FILE_NAME, serialiseConfig(config));
}

// Read-modify-write a single setting. Preferences are written far less often than
// document content, so the extra read costs nothing and keeps callers from having
// to hold a whole Config just to flip the theme.
//
// The read is also the guard: `readConfig` throws on a file it could not read, so
// this rejects before `writeConfig` is reached and the file on disk is left alone.
// Refusing to write over settings we never saw is the whole point of that throw —
// a caller must never turn one flipped switch into a fresh file of defaults.
export async function updateConfig(
    root: FileSystemDirectoryHandle,
    patch: Partial<Config>
): Promise<Config> {
    const next = { ...(await readConfig(root)), ...patch };
    await writeConfig(root, next);
    return next;
}
