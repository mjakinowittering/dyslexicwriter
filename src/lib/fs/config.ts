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

export async function readConfig(
    root: FileSystemDirectoryHandle
): Promise<Config> {
    try {
        const handle = await root.getFileHandle(CONFIG_FILE_NAME);
        const text = await (await handle.getFile()).text();
        // parseConfig validates and falls back to defaults; a hand-edited or
        // truncated file must never stop the user reaching their documents.
        return parseConfig(JSON.parse(text));
    } catch {
        // Missing (first run) or unparseable JSON — start from defaults.
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
export async function updateConfig(
    root: FileSystemDirectoryHandle,
    patch: Partial<Config>
): Promise<Config> {
    const next = { ...(await readConfig(root)), ...patch };
    await writeConfig(root, next);
    return next;
}
