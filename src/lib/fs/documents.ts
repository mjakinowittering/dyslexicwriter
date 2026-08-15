import type { JSONContent } from '@tiptap/core';

import { fromMarkdown, toMarkdown } from '$lib/markdown';
import {
    CONFIG_FILE_NAME,
    type DocumentIndexEntry
} from '$lib/models/config.model';
import {
    fileNameFor,
    MARKDOWN_EXTENSION,
    nextUntitledName,
    sanitiseTitle
} from '$lib/models/document.model';
import * as m from '$lib/paraglide/messages';

// Every filesystem operation on documents. One folder per document, holding a
// markdown file of the same name plus that document's images:
//
//   My Chapter/
//     My Chapter.md
//     diagram.png
//
// The folder on disk is the authority. `config.json`'s document list is only a
// cache for the Files screen, reconciled by scanFolder on load.

export class DocumentError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = 'DocumentError';
    }
}

// Find the markdown file inside a document folder. Normally `<folder>.md`, but we
// fall back to the first .md present so a document survives the user renaming the
// file by hand outside the app.
async function findMarkdownFile(
    dir: FileSystemDirectoryHandle
): Promise<FileSystemFileHandle | null> {
    const preferred = `${dir.name}${MARKDOWN_EXTENSION}`;
    let fallback: FileSystemFileHandle | null = null;

    for await (const entry of dir.values()) {
        if (entry.kind !== 'file') continue;
        if (!entry.name.endsWith(MARKDOWN_EXTENSION)) continue;
        if (entry.name === preferred) return entry;
        fallback ??= entry;
    }

    return fallback;
}

// List every document folder under the working directory. This is the source of
// truth the config index is reconciled against.
export async function scanFolder(
    root: FileSystemDirectoryHandle
): Promise<DocumentIndexEntry[]> {
    const found: DocumentIndexEntry[] = [];

    for await (const entry of root.values()) {
        if (entry.kind !== 'directory') continue;

        const file = await findMarkdownFile(entry);
        if (!file) continue;

        found.push({
            title: entry.name,
            folder: entry.name,
            file: file.name,
            lastModified: (await file.getFile()).lastModified
        });
    }

    return found.sort((a, b) => b.lastModified - a.lastModified);
}

// Folder names already in use, so a new document can pick a free "Untitled N".
// config.json is excluded because it is a file, not a document folder.
export async function takenFolderNames(
    root: FileSystemDirectoryHandle
): Promise<Set<string>> {
    const names = new Set<string>();

    for await (const entry of root.values()) {
        if (entry.kind === 'directory') names.add(entry.name);
        else if (entry.name === CONFIG_FILE_NAME) continue;
    }

    return names;
}

export async function suggestUntitledName(
    root: FileSystemDirectoryHandle
): Promise<string> {
    return nextUntitledName(await takenFolderNames(root));
}

export interface OpenedDocument {
    title: string;
    folder: string;
    file: string;
    contentJson: JSONContent;
}

export async function readDocument(
    root: FileSystemDirectoryHandle,
    folder: string
): Promise<OpenedDocument> {
    let dir: FileSystemDirectoryHandle;
    try {
        dir = await root.getDirectoryHandle(folder);
    } catch (cause) {
        throw new DocumentError(m.files_open_error({ folder }), { cause });
    }

    const file = await findMarkdownFile(dir);
    if (!file) {
        throw new DocumentError(m.files_no_markdown({ folder }));
    }

    const markdown = await (await file.getFile()).text();

    return {
        title: dir.name,
        folder: dir.name,
        file: file.name,
        contentJson: fromMarkdown(markdown)
    };
}

// Write a document to disk, creating its folder and file on first save.
//
// Markdown is derived BEFORE the writable is opened: if serialization throws, the
// existing file on disk is left untouched rather than truncated to nothing.
export async function writeDocument(
    root: FileSystemDirectoryHandle,
    folder: string,
    contentJson: JSONContent
): Promise<DocumentIndexEntry> {
    const markdown = toMarkdown(contentJson);

    const dir = await root.getDirectoryHandle(folder, { create: true });
    const fileName = fileNameFor(folder);
    const handle = await dir.getFileHandle(fileName, { create: true });

    const writable = await handle.createWritable();
    await writable.write(markdown);
    await writable.close();

    return {
        title: folder,
        folder,
        file: fileName,
        lastModified: Date.now()
    };
}

// Rename a document: establish the new FOLDER first, then the markdown file
// inside it, and only remove the old folder once everything has landed.
//
// Chromium's `FileSystemHandle.move()` is reliable for files but not for
// directories, so a folder rename is a copy followed by a delete. The ordering is
// what makes that safe: the source is removed LAST, so a failure at any point
// leaves the original folder intact. The worst case is a duplicate, never a loss.
//
// Images need no special handling — they are copied along with everything else in
// the folder, and keep their relative paths.
export async function renameDocument(
    root: FileSystemDirectoryHandle,
    from: string,
    to: string
): Promise<DocumentIndexEntry> {
    const target = sanitiseTitle(to);
    const source = await root.getDirectoryHandle(from);

    if (target === from) {
        const file = await findMarkdownFile(source);
        return {
            title: from,
            folder: from,
            file: file?.name ?? fileNameFor(from),
            lastModified: Date.now()
        };
    }

    if (await folderExists(root, target)) {
        throw new DocumentError(m.files_exists_error({ title: target }));
    }

    const fileName = fileNameFor(target);
    const oldMarkdown = (await findMarkdownFile(source))?.name;

    // 1. The new folder.
    const destination = await root.getDirectoryHandle(target, { create: true });

    // 2. Its contents, with the markdown file taking the new name as it goes.
    for await (const entry of source.values()) {
        if (entry.kind !== 'file') continue;

        const name = entry.name === oldMarkdown ? fileName : entry.name;
        const data = await entry.getFile();
        const handle = await destination.getFileHandle(name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(await data.arrayBuffer());
        await writable.close();
    }

    // 3. Only now is it safe to drop the original.
    await root.removeEntry(from, { recursive: true });

    return {
        title: target,
        folder: target,
        file: fileName,
        lastModified: Date.now()
    };
}

export async function deleteDocument(
    root: FileSystemDirectoryHandle,
    folder: string
): Promise<void> {
    try {
        await root.removeEntry(folder, { recursive: true });
    } catch (cause) {
        throw new DocumentError(m.files_delete_error({ title: folder }), {
            cause
        });
    }
}

export async function folderExists(
    root: FileSystemDirectoryHandle,
    folder: string
): Promise<boolean> {
    try {
        await root.getDirectoryHandle(folder);
        return true;
    } catch {
        return false;
    }
}

// Write a dropped or pasted image into the document's OWN folder and return the
// relative name to reference it by. Never a shared images folder and never a
// base64 data URI: a document folder must stay self-contained and portable.
export async function writeImage(
    root: FileSystemDirectoryHandle,
    folder: string,
    file: File
): Promise<string> {
    const dir = await root.getDirectoryHandle(folder, { create: true });
    const name = await uniqueImageName(dir, file.name);

    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(await file.arrayBuffer());
    await writable.close();

    return name;
}

// Never overwrite an existing image: suffix until the name is free.
async function uniqueImageName(
    dir: FileSystemDirectoryHandle,
    original: string
): Promise<string> {
    const safe = original.replace(/[/\\]/g, '-').replace(/^\.+/, '') || 'image';
    const dot = safe.lastIndexOf('.');
    const stem = dot > 0 ? safe.slice(0, dot) : safe;
    const ext = dot > 0 ? safe.slice(dot) : '';

    let candidate = safe;
    let n = 2;
    while (await fileExists(dir, candidate)) {
        candidate = `${stem}-${n}${ext}`;
        n += 1;
    }

    return candidate;
}

async function fileExists(
    dir: FileSystemDirectoryHandle,
    name: string
): Promise<boolean> {
    try {
        await dir.getFileHandle(name);
        return true;
    } catch {
        return false;
    }
}
