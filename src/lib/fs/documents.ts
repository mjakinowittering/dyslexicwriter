import type { JSONContent } from '@tiptap/core';

import {
    fromMarkdown,
    joinFrontmatter,
    splitFrontmatter,
    toMarkdown,
    type Frontmatter
} from '$lib/markdown';
import { CONFIG_FILE_NAME } from '$lib/models/config.model';
import {
    fileNameFor,
    joinPath,
    lastSegment,
    MARKDOWN_EXTENSION,
    nextUntitledName,
    parentPath,
    pathSegments,
    sanitiseTitle,
    titleFromFileName,
    type DocumentIndexEntry
} from '$lib/models/document.model';
import * as m from '$lib/paraglide/messages';

// Every filesystem operation on documents.
//
// The app CREATES one folder per document, holding a markdown file of the same
// name plus that document's images:
//
//   My Chapter/
//     My Chapter.md
//     diagram.png
//
// but it FINDS whatever is actually there. Point it at an existing writing folder
// and there will be loose files at the root and chapters nested several levels
// down, so the scan walks the tree and takes every markdown file it reaches.
//
// That gives two kinds of document:
//
//   folder-document  `X/X.md`, alone in its folder — the shape above. Renaming
//                    moves the folder, deleting removes it whole, images go inside.
//   file-document    a markdown file sitting among others. Renaming renames the
//                    file alone, deleting removes only it, images go beside it.
//
// The folder on disk is the only authority. Nothing caches this list: `scanFolder`
// walks it into the workspace store on load, every screen renders from there, and
// it is scanned again rather than remembered.

// How many directory levels below the working folder the initial scan walks. A
// directory the cap stops at is returned unloaded, and the Files screen scans it
// on demand when the user expands it — an unbounded walk of somebody's whole
// Documents tree is slow enough to read as broken.
export const SCAN_DEPTH = 3;

// Never worth walking into, and never a place a writer keeps a chapter.
const SKIPPED_DIRECTORIES = new Set(['node_modules']);

export class DocumentError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = 'DocumentError';
    }
}

// Where a document lives, and which of the two kinds it is. Everything that
// writes to disk takes one of these rather than a bare folder name.
export interface DocumentLocation {
    // '/'-joined path to the containing directory, '' for the working folder.
    folder: string;
    // The markdown file's name within that directory, extension included.
    file: string;
    ownsFolder: boolean;
}

// Walk a '/'-joined path down to a directory handle.
//
// Paths are assembled by the app from segments sanitiseTitle already owns, never
// parsed out of user input — but `.` and `..` are refused here anyway, because a
// path that escapes the working folder is the one mistake with no recovery.
async function resolveDirectory(
    root: FileSystemDirectoryHandle,
    path: string,
    options?: { create?: boolean }
): Promise<FileSystemDirectoryHandle> {
    let dir = root;

    for (const segment of pathSegments(path)) {
        if (segment === '.' || segment === '..') {
            throw new DocumentError(m.files_open_error({ folder: path }));
        }
        dir = await dir.getDirectoryHandle(segment, options);
    }

    return dir;
}

interface DirectoryListing {
    markdown: FileSystemFileHandle[];
    subdirectories: FileSystemDirectoryHandle[];
    // Files this screen will never show: a .docx, a .png, a stray .txt. Counted
    // rather than kept, because the only question they answer is whether a folder
    // showing no documents is empty or merely full of things we cannot open.
    others: number;
}

// One pass over a directory, splitting it into the markdown files we show and the
// subdirectories we may walk into. Every other file is counted and dropped;
// dot-entries are skipped outright.
//
// `config.json` is not counted among them. The app wrote it, so a working folder
// holding nothing else is empty as far as the user is concerned — saying
// otherwise would have the app pointing at its own settings file as content.
async function listDirectory(
    dir: FileSystemDirectoryHandle
): Promise<DirectoryListing> {
    const markdown: FileSystemFileHandle[] = [];
    const subdirectories: FileSystemDirectoryHandle[] = [];
    let others = 0;

    for await (const entry of dir.values()) {
        if (entry.name.startsWith('.')) continue;

        if (entry.kind === 'directory') {
            subdirectories.push(entry);
        } else if (entry.name.endsWith(MARKDOWN_EXTENSION)) {
            markdown.push(entry);
        } else if (entry.name !== CONFIG_FILE_NAME) {
            others += 1;
        }
    }

    return { markdown, subdirectories, others };
}

// Does this markdown file own the folder it sits in?
//
// Only when the folder is named after it and holds nothing else — no second
// document, no subdirectory. Both of those extra conditions exist for DELETE: a
// folder-document is removed recursively, so a folder with anything else in it
// must never qualify, or deleting one document takes its neighbours with it.
function ownsItsFolder(
    folder: string,
    file: string,
    listing: DirectoryListing
): boolean {
    return (
        folder !== '' &&
        listing.markdown.length === 1 &&
        listing.subdirectories.length === 0 &&
        titleFromFileName(file) === lastSegment(folder)
    );
}

async function toIndexEntry(
    handle: FileSystemFileHandle,
    folder: string,
    listing: DirectoryListing
): Promise<DocumentIndexEntry> {
    return {
        title: titleFromFileName(handle.name),
        folder,
        file: handle.name,
        ownsFolder: ownsItsFolder(folder, handle.name, listing),
        lastModified: (await handle.getFile()).lastModified
    };
}

// A directory as the Files screen shows it: the documents directly inside it, and
// the subdirectories below it.
export interface FolderNode {
    // The directory's own name. Empty for the working folder itself.
    name: string;
    // '/'-joined path relative to the working folder. '' is the working folder.
    path: string;
    folders: FolderNode[];
    documents: DocumentIndexEntry[];
    // False when the depth cap stopped the walk here, so the children are not
    // known yet rather than known to be absent.
    loaded: boolean;
    // True when this directory, or one the scan reached below it, held something
    // this tree is not showing — a file the app cannot open, or a skipped
    // directory.
    //
    // It exists so the Files screen can tell an empty folder from one full of
    // .docx files. Both show no documents; only one of them is empty, and saying
    // "nothing here yet" about a folder of somebody's work reads as if the app
    // threw it away. Read at the root for the screen's empty state, and per
    // folder for what an expanded but empty disclosure says.
    hasOtherEntries: boolean;
}

function byName(a: { name: string }, b: { name: string }): number {
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function byTitle(a: { title: string }, b: { title: string }): number {
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}

// The document a folder gives way to in the tree: the one it holds, sitting
// directly in it, and NAMED AFTER IT. That is `My Chapter/My Chapter.md` and
// nothing else — the shape the app creates for itself, where the folder is a
// disclosure the writer must open to find the single file repeating its name.
//
// The name check is what keeps this to that shape. Without it any folder holding
// one document gave way, and it cascaded: `Book/Chapters/One.md` surfaced `One`
// at the root with `Book` and `Chapters` gone from the tree entirely, so the list
// no longer matched the folder on disk. It also swallowed folders the writer had
// just made and filed a document into.
//
// On disk the folder is untouched, and the document's `folder` still points
// inside it, so rename, delete and image writes behave exactly as they did.
//
// An unloaded folder is never collapsed: we have not looked inside it, so one
// document is not yet known to be all there is.
function onlyDocument(node: FolderNode): DocumentIndexEntry | null {
    if (!node.loaded || node.folders.length > 0) return null;
    if (node.documents.length !== 1) return null;

    const entry = node.documents[0];
    if (!entry) return null;

    // Lifted out of a subfolder a moment ago rather than sitting here, so this
    // folder is not the one it would be collapsing into.
    if (entry.folder !== node.path) return null;
    if (titleFromFileName(entry.file) !== node.name) return null;

    return entry;
}

async function walk(
    dir: FileSystemDirectoryHandle,
    path: string,
    depth: number
): Promise<FolderNode> {
    const listing = await listDirectory(dir);

    const documents = await Promise.all(
        listing.markdown.map((handle) => toIndexEntry(handle, path, listing))
    );

    const folders: FolderNode[] = [];
    // Anything here the tree will not be showing: files we cannot open, and — as
    // the loop below finds them — directories skipped outright. Carried up from
    // every child so the root alone can answer for the whole scan, and so a
    // folder row can say "nothing we can open" rather than "nothing in here".
    let hasOtherEntries = listing.others > 0;

    for (const child of listing.subdirectories) {
        if (SKIPPED_DIRECTORIES.has(child.name)) {
            hasOtherEntries = true;
            continue;
        }

        const childPath = joinPath(path, child.name);

        const node =
            depth > 0
                ? await walk(child, childPath, depth - 1)
                : {
                      name: child.name,
                      path: childPath,
                      folders: [],
                      documents: [],
                      loaded: false,
                      // Nothing has been looked at, so nothing is known to be
                      // unshowable. The folder itself is shown either way.
                      hasOtherEntries: false
                  };

        if (node.hasOtherEntries) hasOtherEntries = true;

        // A folder that is nothing but the document named after it shows as that
        // document, lifted into this level rather than hidden behind a
        // disclosure. Every other folder keeps its row — including an empty one,
        // which is very often one the writer has just made to file writing into,
        // and one holding nothing this app can open, which is theirs either way.
        const single = onlyDocument(node);
        if (single) documents.push(single);
        else folders.push(node);
    }

    return {
        name: dir.name,
        path,
        folders: folders.sort(byName),
        documents: documents.sort(byTitle),
        loaded: true,
        hasOtherEntries
    };
}

// Scan a directory tree for documents. Called with no path for the working folder
// itself, and with one when the user expands a folder the depth cap stopped at.
export async function scanFolder(
    root: FileSystemDirectoryHandle,
    options?: { path?: string; depth?: number }
): Promise<FolderNode> {
    const path = options?.path ?? '';
    const dir = await resolveDirectory(root, path);

    return walk(dir, path, options?.depth ?? SCAN_DEPTH);
}

// Every document currently known, in the order the Files screen shows them —
// folders first, then the documents sitting directly in this one. The
// config.json index is a cache for that screen, so it is worth it being in the
// same order the screen will read it back in.
export function flattenDocuments(node: FolderNode): DocumentIndexEntry[] {
    return [
        ...node.folders.flatMap((child) => flattenDocuments(child)),
        ...node.documents
    ];
}

// Locate a document within an already-scanned tree, so its row can be updated
// without re-walking the folder.
//
// Searched level by level rather than looked up under `entry.folder`, because a
// folder holding nothing but this document is collapsed into its parent: the row
// sits ABOVE the folder the path names, and often several levels above it.
export function findDocument(
    node: FolderNode,
    entry: DocumentLocation
): DocumentIndexEntry | null {
    const here = node.documents.find(
        (found) => found.folder === entry.folder && found.file === entry.file
    );
    if (here) return here;

    for (const child of node.folders) {
        // Only descend where the document could actually be.
        if (
            entry.folder !== child.path &&
            !entry.folder.startsWith(`${child.path}/`)
        ) {
            continue;
        }

        const found = findDocument(child, entry);
        if (found) return found;
    }

    return null;
}

// Folder names already in use at the top level, so a new document can pick a free
// "Untitled N". New documents are always created as a folder-document beside the
// user's other work, never inside a subfolder.
export async function takenFolderNames(
    root: FileSystemDirectoryHandle
): Promise<Set<string>> {
    const names = new Set<string>();

    for await (const entry of root.values()) {
        if (entry.kind === 'directory') names.add(entry.name);
    }

    return names;
}

export async function suggestUntitledName(
    root: FileSystemDirectoryHandle
): Promise<string> {
    return nextUntitledName(await takenFolderNames(root));
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

export interface OpenedDocument extends DocumentLocation {
    title: string;
    contentJson: JSONContent;
    // The file's YAML frontmatter, if it had any. Carried so it can be written
    // back untouched — nothing in the app reads it.
    frontmatter: Frontmatter | null;
    // When the file on disk was last written, so the status bar can say how
    // current the copy it just opened is instead of waiting for a first save.
    lastModified: number;
}

// Open a document by the path of its markdown file, relative to the working
// folder: `notes.md`, `Chapters/One.md`.
//
// A path with no markdown extension is treated as a document FOLDER instead, so a
// link or open tab from before the tree existed (`?doc=My%20Chapter`) still opens
// the right thing rather than 404-ing at the user.
export async function readDocument(
    root: FileSystemDirectoryHandle,
    path: string
): Promise<OpenedDocument> {
    const asFile = path.endsWith(MARKDOWN_EXTENSION);
    const folder = asFile ? parentPath(path) : path;

    let dir: FileSystemDirectoryHandle;
    try {
        dir = await resolveDirectory(root, folder);
    } catch (cause) {
        throw new DocumentError(m.files_open_error({ folder: path }), {
            cause
        });
    }

    const listing = await listDirectory(dir);

    let handle: FileSystemFileHandle | null;
    if (asFile) {
        const name = lastSegment(path);
        handle = listing.markdown.find((file) => file.name === name) ?? null;
    } else {
        handle = await findMarkdownFile(dir);
    }

    if (!handle) {
        throw new DocumentError(m.files_no_markdown({ folder: path }));
    }

    // One snapshot of the file, read for both its text and its mtime: taking the
    // handle twice could straddle a write and pair one version's bytes with
    // another version's timestamp.
    const file = await handle.getFile();

    // A file written by Obsidian, Hugo or Jekyll may open with a `---` fence the
    // editor knows nothing about. Split it off rather than letting it through as
    // prose, and hold it for the write back.
    const { frontmatter, body } = splitFrontmatter(await file.text());

    return {
        title: titleFromFileName(handle.name),
        folder,
        file: handle.name,
        ownsFolder: ownsItsFolder(folder, handle.name, listing),
        contentJson: fromMarkdown(body),
        frontmatter,
        lastModified: file.lastModified
    };
}

// Write a document to disk, creating its folder and file on first save.
//
// The WHOLE file — frontmatter included — is derived BEFORE the writable is
// opened: opening one truncates the file, so a throw after that point would leave
// nothing where the user's chapter was.
export async function writeDocument(
    root: FileSystemDirectoryHandle,
    location: DocumentLocation,
    contentJson: JSONContent,
    frontmatter: Frontmatter | null = null
): Promise<DocumentIndexEntry> {
    const markdown = joinFrontmatter(frontmatter, toMarkdown(contentJson));

    const dir = await resolveDirectory(root, location.folder, { create: true });
    const handle = await dir.getFileHandle(location.file, { create: true });

    const writable = await handle.createWritable();
    await writable.write(markdown);
    await writable.close();

    return {
        title: titleFromFileName(location.file),
        folder: location.folder,
        file: location.file,
        ownsFolder: location.ownsFolder,
        lastModified: Date.now()
    };
}

// Create a document inside a folder the user picked, named as it is made.
//
// Unlike the editor's "New document" — which stays in memory until there is
// something worth writing — this one is written immediately: the writer has
// already typed the name and expects to see the row appear in that folder. The
// file lands beside whatever else is in there, so it is a file-document; the
// only shape the app creates for itself remains the top-level folder-document.
//
// The name is checked against the directory here rather than trusted from the
// tree: the tree is a scan snapshot and can always be out of date by the time
// this runs.
export async function createDocument(
    root: FileSystemDirectoryHandle,
    folder: string,
    title: string
): Promise<DocumentIndexEntry> {
    const target = sanitiseTitle(title);
    const fileName = fileNameFor(target);

    const dir = await resolveDirectory(root, folder);
    if (await entryExists(dir, fileName, 'file')) {
        throw new DocumentError(m.files_exists_error({ title: target }));
    }

    // `ownsFolder: false` is not a claim, it is a placeholder — the scan that
    // follows recomputes it off the real directory listing, which is the only
    // authority for it. A document named after the folder it is created in will
    // come back owning it, and should.
    return writeDocument(
        root,
        { folder, file: fileName, ownsFolder: false },
        {
            type: 'doc',
            content: [{ type: 'paragraph' }]
        }
    );
}

async function copyFile(
    source: FileSystemFileHandle,
    destination: FileSystemDirectoryHandle,
    name: string
): Promise<void> {
    const data = await source.getFile();
    const handle = await destination.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(await data.arrayBuffer());
    await writable.close();
}

// Rename a document. Whichever kind it is, the ORDERING is the same: establish
// everything under the new name first, and remove the old name last. A failure at
// any point leaves the original intact — the worst case is a duplicate, never a
// loss.
export async function renameDocument(
    root: FileSystemDirectoryHandle,
    location: DocumentLocation,
    nextTitle: string
): Promise<DocumentIndexEntry> {
    const target = sanitiseTitle(nextTitle);
    const fileName = fileNameFor(target);

    if (target === titleFromFileName(location.file)) {
        return {
            title: target,
            folder: location.folder,
            file: location.file,
            ownsFolder: location.ownsFolder,
            lastModified: Date.now()
        };
    }

    return location.ownsFolder
        ? renameFolderDocument(root, location, target, fileName)
        : renameFileDocument(root, location, target, fileName);
}

// A folder-document moves as a whole. Chromium's `FileSystemHandle.move()` is
// reliable for files but not for directories, so this is a copy followed by a
// delete, inside the folder's OWN parent rather than at the working folder.
//
// Images need no special handling — they are copied along with everything else in
// the folder, and keep their relative paths.
async function renameFolderDocument(
    root: FileSystemDirectoryHandle,
    location: DocumentLocation,
    target: string,
    fileName: string
): Promise<DocumentIndexEntry> {
    const parent = parentPath(location.folder);
    const parentDir = await resolveDirectory(root, parent);
    const sourceName = lastSegment(location.folder);

    if (await entryExists(parentDir, target, 'directory')) {
        throw new DocumentError(m.files_exists_error({ title: target }));
    }

    const source = await parentDir.getDirectoryHandle(sourceName);

    // 1. The new folder.
    const destination = await parentDir.getDirectoryHandle(target, {
        create: true
    });

    // 2. Its contents, with the markdown file taking the new name as it goes.
    for await (const entry of source.values()) {
        if (entry.kind !== 'file') continue;

        const name = entry.name === location.file ? fileName : entry.name;
        await copyFile(entry, destination, name);
    }

    // 3. Only now is it safe to drop the original.
    await parentDir.removeEntry(sourceName, { recursive: true });

    return {
        title: target,
        folder: joinPath(parent, target),
        file: fileName,
        ownsFolder: true,
        lastModified: Date.now()
    };
}

// A file-document is one markdown file among others, so only the file is renamed.
// Its folder belongs to the user, not to this document, and any images beside it
// may be shared with its neighbours — moving either would be a change nobody
// asked for.
async function renameFileDocument(
    root: FileSystemDirectoryHandle,
    location: DocumentLocation,
    target: string,
    fileName: string
): Promise<DocumentIndexEntry> {
    const dir = await resolveDirectory(root, location.folder);

    if (await entryExists(dir, fileName, 'file')) {
        throw new DocumentError(m.files_exists_error({ title: target }));
    }

    const source = await dir.getFileHandle(location.file);

    // New file first, old file last — same guarantee as the folder case.
    await copyFile(source, dir, fileName);
    await dir.removeEntry(location.file);

    return {
        title: target,
        folder: location.folder,
        file: fileName,
        ownsFolder: false,
        lastModified: Date.now()
    };
}

// Remove a document. A folder-document takes its folder with it; a file-document
// takes only itself, leaving its neighbours and the folder alone. The Files screen
// confirms with copy that says which of the two is about to happen.
export async function deleteDocument(
    root: FileSystemDirectoryHandle,
    location: DocumentLocation
): Promise<void> {
    const title = titleFromFileName(location.file);

    try {
        if (location.ownsFolder) {
            const parentDir = await resolveDirectory(
                root,
                parentPath(location.folder)
            );
            await parentDir.removeEntry(lastSegment(location.folder), {
                recursive: true
            });
        } else {
            const dir = await resolveDirectory(root, location.folder);
            await dir.removeEntry(location.file);
        }
    } catch (cause) {
        throw new DocumentError(m.files_delete_error({ title }), { cause });
    }
}

// Make a folder inside the working folder, so writing can be filed into a tree
// the writer arranges rather than a flat list.
//
// Deliberately NOT `ensureSubfolder`. That one reuses a directory already sitting
// there, which is exactly right for the welcome screen's "start a new folder"
// card — a second run must land back in the user's writing rather than beside it
// — and exactly wrong here, where silently adopting somebody's existing
// "Chapters" is not what the writer asked for. Refuse instead, before anything
// reaches the disk, and refuse against a file of that name too: the browser will
// not create a directory over one, and the message should say which it is.
export async function createFolder(
    root: FileSystemDirectoryHandle,
    parent: string,
    name: string
): Promise<string> {
    const safe = sanitiseTitle(name);

    const dir = await resolveDirectory(root, parent);
    if (
        (await entryExists(dir, safe, 'directory')) ||
        (await entryExists(dir, safe, 'file'))
    ) {
        throw new DocumentError(m.files_folder_exists_error({ name: safe }));
    }

    try {
        await dir.getDirectoryHandle(safe, { create: true });
    } catch (cause) {
        throw new DocumentError(m.files_folder_create_error({ name: safe }), {
            cause
        });
    }

    return joinPath(parent, safe);
}

// Remove an empty folder — one made by mistake, or left behind after its last
// document went.
//
// The safety here is the browser's, not the UI's: `removeEntry` WITHOUT
// `recursive` is refused outright when the directory is not empty. That is the
// opposite of `deleteDocument` above, which passes `recursive: true` on purpose
// because a folder-document's folder is the document. Nothing here may ever take
// a neighbour with it, so the flag must stay off however the caller is gated.
export async function deleteFolder(
    root: FileSystemDirectoryHandle,
    path: string
): Promise<void> {
    const name = lastSegment(path);

    try {
        const parentDir = await resolveDirectory(root, parentPath(path));
        await parentDir.removeEntry(name);
    } catch (cause) {
        throw new DocumentError(m.files_folder_delete_error({ name }), {
            cause
        });
    }
}

export async function folderExists(
    root: FileSystemDirectoryHandle,
    folder: string
): Promise<boolean> {
    try {
        await resolveDirectory(root, folder);
        return true;
    } catch {
        return false;
    }
}

// Does this handle still point at a directory that is actually there?
//
// A stored handle outlives the folder it names — renamed, moved, or on a drive
// that has since been unplugged — and the browser will happily grant permission
// for something that no longer exists, so the only honest check is to touch it.
// Reading one entry is enough and costs nothing on a large folder.
export async function folderIsReachable(
    handle: FileSystemDirectoryHandle
): Promise<boolean> {
    try {
        await handle.keys().next();
        return true;
    } catch {
        return false;
    }
}

// The folder the welcome screen offers to make for a user who has no opinion
// about where their writing should live. The directory picker cannot be pointed
// at a path, so "Documents/DyslexicWriter" is reached by opening the picker at
// Documents and creating this inside whatever the user actually picks.
export const SUGGESTED_FOLDER_NAME = 'DyslexicWriter';

// Get a subfolder of the chosen directory, making it only if it isn't there.
// Reusing an existing folder is the point: a second run must land back in the
// user's writing rather than beside it in a `DyslexicWriter 2`.
export async function ensureSubfolder(
    parent: FileSystemDirectoryHandle,
    name: string
): Promise<FileSystemDirectoryHandle> {
    return parent.getDirectoryHandle(name, { create: true });
}

// Write a dropped or pasted image into the document's own directory and return
// the relative name to reference it by. Never a shared images folder and never a
// base64 data URI: a document folder must stay self-contained and portable.
//
// For a file-document that directory is the user's own folder, so the image lands
// beside the markdown that references it — which is what "beside it" has to mean
// when there is no folder belonging to this document alone.
export async function writeImage(
    root: FileSystemDirectoryHandle,
    folder: string,
    file: File
): Promise<string> {
    const dir = await resolveDirectory(root, folder, { create: true });
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
    while (await entryExists(dir, candidate, 'file')) {
        candidate = `${stem}-${n}${ext}`;
        n += 1;
    }

    return candidate;
}

async function entryExists(
    dir: FileSystemDirectoryHandle,
    name: string,
    kind: 'file' | 'directory'
): Promise<boolean> {
    try {
        if (kind === 'file') await dir.getFileHandle(name);
        else await dir.getDirectoryHandle(name);
        return true;
    } catch {
        return false;
    }
}
