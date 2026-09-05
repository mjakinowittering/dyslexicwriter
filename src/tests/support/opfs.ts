import type { FolderNode } from '$lib/fs';
import type { DocumentIndexEntry } from '$lib/models/document.model';

// A real filesystem for the suites that drive the fs layer.
//
// navigator.storage.getDirectory() hands back genuine FileSystemDirectoryHandle
// objects — the same API the app drives against the user's chosen folder. That
// makes these tests a genuine check of the save/rename ordering rather than an
// assertion about a mock. Browser project only: OPFS does not exist in node.
//
// Every helper takes the root explicitly, so a suite can bind it once in
// beforeEach and call the wrappers with the paths alone.

// Every document in a scanned tree, flattened into the order the Files screen
// shows them — folders first, then the documents sitting directly in this one.
//
// A test-only convenience. The app renders the tree itself and has no index to
// flatten it into, so this lives here rather than in `fs/documents.ts`: asserting
// a scan as a flat list of paths is a thing suites want and the app never does.
export function flattenDocuments(node: FolderNode): DocumentIndexEntry[] {
    return [
        ...node.folders.flatMap((child) => flattenDocuments(child)),
        ...node.documents
    ];
}

// Wipe OPFS and hand back the empty root, so one test can never see another's
// files. Call it from beforeEach.
export async function emptyRoot(): Promise<FileSystemDirectoryHandle> {
    const opfs = await navigator.storage.getDirectory();
    for await (const name of opfs.keys()) {
        await opfs.removeEntry(name, { recursive: true });
    }
    return opfs;
}

// Walk (creating as it goes) a '/'-joined path below the root. '' is the root
// itself — where a loose `notes.md` lives.
export async function directory(
    root: FileSystemDirectoryHandle,
    path: string
): Promise<FileSystemDirectoryHandle> {
    let dir = root;
    for (const segment of path.split('/').filter(Boolean)) {
        dir = await dir.getDirectoryHandle(segment, { create: true });
    }
    return dir;
}

// Put a file on disk without going through the app's writers — the "somebody
// else's folder" the scan has to cope with.
export async function writeRaw(
    root: FileSystemDirectoryHandle,
    folder: string,
    file: string,
    text: string
): Promise<void> {
    const dir = await directory(root, folder);
    const handle = await dir.getFileHandle(file, { create: true });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
}

export async function readFile(
    root: FileSystemDirectoryHandle,
    folder: string,
    file: string
): Promise<string> {
    const dir = await directory(root, folder);
    const handle = await dir.getFileHandle(file);
    return (await handle.getFile()).text();
}

export async function fileExists(
    root: FileSystemDirectoryHandle,
    folder: string,
    file: string
): Promise<boolean> {
    try {
        await (await directory(root, folder)).getFileHandle(file);
        return true;
    } catch {
        return false;
    }
}
