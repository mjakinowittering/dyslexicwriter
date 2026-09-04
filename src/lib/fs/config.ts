import {
    CONFIG_FILE_NAME,
    defaultConfig,
    parseConfig,
    type Config
} from '$lib/models/config.model';

// Read and write `config.json` in the root of the user's working folder.
//
// This is the only settings store in the app. Because it lives in the user's own
// folder rather than in browser storage, moving that folder to another machine or
// browser brings the preferences along with the writing.

// Is there simply no settings file yet?
//
// The one failure that means "start from the defaults", and narrow on purpose: a
// folder the user has just chosen has no config.json in it. Every other failure —
// a permission we no longer have, an unplugged drive, a file we cannot open — is
// a settings file we could not READ rather than one that is not THERE, and the
// difference decides whether the next preference the user changes gets written
// over settings that are sitting on disk perfectly intact.
//
// Deliberately not shared with `isMissingEntry` in documents.ts. The check is the
// same two lines; what it protects is not, and coupling this module's read path
// to the scan's would make either one harder to change on its own terms.
function isMissingFile(cause: unknown): boolean {
    return cause instanceof DOMException && cause.name === 'NotFoundError';
}

export async function readConfig(
    root: FileSystemDirectoryHandle
): Promise<Config> {
    let text: string;

    try {
        const handle = await root.getFileHandle(CONFIG_FILE_NAME);
        text = await (await handle.getFile()).text();
    } catch (cause) {
        // First run: nothing has written settings here yet.
        if (isMissingFile(cause)) return defaultConfig();
        // Anything else, and we do not know what this file holds. Let it out
        // rather than answering with defaults the caller cannot tell apart from
        // a real read — see `updateConfig` for what that protects.
        throw cause;
    }

    try {
        // parseConfig validates and falls back to defaults key by key; a
        // hand-edited value must never stop the user reaching their documents.
        return parseConfig(JSON.parse(text));
    } catch {
        // The file read fine and holds something that is not JSON at all — a
        // hand edit that got away. parseConfig covers every malformed value
        // inside a valid object; this covers the object itself. There is nothing
        // to recover either way, so defaults it is, and the next preference the
        // user changes writes a good file back over the broken one.
        return defaultConfig();
    }
}

export async function writeConfig(
    root: FileSystemDirectoryHandle,
    config: Config
): Promise<void> {
    const handle = await root.getFileHandle(CONFIG_FILE_NAME, { create: true });
    const writable = await handle.createWritable();
    await writable.write(`${JSON.stringify(config, null, 2)}\n`);
    await writable.close();
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
