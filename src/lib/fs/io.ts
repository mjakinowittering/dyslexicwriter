// The two raw filesystem primitives `config.ts` and `documents.ts` both need.
//
// Deliberately small and deliberately dumb: neither of these knows anything
// about documents or settings. What each caller *does* with the answer is the
// part that differs, and that reasoning stays at the call site.

// Did this fail because the thing we asked for is not there?
//
// The one DOMException worth telling apart from every other failure. A folder is
// live — the writer's file manager, a sync client, and this app's own rename all
// change it underneath a listing — so an entry that was there a moment ago can be
// gone by the time we stat it, and a settings file that has never existed is a
// first run rather than a fault.
//
// Narrow on purpose. Every other failure, a permission we no longer have most of
// all, is not this and must not be treated as it.
export function isNotFoundError(cause: unknown): boolean {
    return cause instanceof DOMException && cause.name === 'NotFoundError';
}

// Write a whole file, creating it if it isn't there.
//
// Starts at `getFileHandle` on purpose, and takes data that is already derived.
// Opening a writable TRUNCATES the file, so anything that could throw — deriving
// markdown, serialising JSON — has to have finished before this is called. A
// helper that took a document and serialised it here would put that throw on the
// wrong side of the truncation, which is how a chapter becomes an empty file.
export async function writeFile(
    dir: FileSystemDirectoryHandle,
    name: string,
    data: FileSystemWriteChunkType
): Promise<FileSystemFileHandle> {
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
    return handle;
}
