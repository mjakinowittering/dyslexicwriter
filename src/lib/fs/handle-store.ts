import Dexie, { type EntityTable } from 'dexie';

// The ONLY use of IndexedDB in this app.
//
// A FileSystemDirectoryHandle is structured-cloneable but has no string form, so
// localStorage genuinely cannot hold it — IndexedDB is the only place it can live.
// Nothing else belongs here: document content lives on the filesystem, and every
// preference lives in config.json.

interface HandleRow {
    id: string;
    handle: FileSystemDirectoryHandle;
}

const ROOT_KEY = 'workingDirectory';

const db = new Dexie('dyslexicwriter') as Dexie & {
    handles: EntityTable<HandleRow, 'id'>;
};

db.version(1).stores({ handles: 'id' });

export async function saveDirectoryHandle(
    handle: FileSystemDirectoryHandle
): Promise<void> {
    await db.handles.put({ id: ROOT_KEY, handle });
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    const row = await db.handles.get(ROOT_KEY);
    return row?.handle ?? null;
}

export async function clearDirectoryHandle(): Promise<void> {
    await db.handles.delete(ROOT_KEY);
}

// A stored handle does not carry its permission grant across sessions. On return
// visits `queryPermission` usually reports 'granted' silently; when it doesn't we
// must ask, and that request has to originate from a user gesture.
export async function ensurePermission(
    handle: FileSystemDirectoryHandle,
    { prompt = false }: { prompt?: boolean } = {}
): Promise<boolean> {
    const options = { mode: 'readwrite' } as const;

    if ((await handle.queryPermission(options)) === 'granted') return true;
    if (!prompt) return false;

    return (await handle.requestPermission(options)) === 'granted';
}
