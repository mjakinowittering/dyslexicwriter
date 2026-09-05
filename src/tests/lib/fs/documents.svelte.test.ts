import * as opfs from '../../support/opfs';
import { flattenDocuments } from '../../support/opfs';
import { beforeEach, describe, expect, it } from 'vitest';

import {
    createDocument,
    createFolder,
    deleteDocument,
    deleteFolder,
    DocumentError,
    ensureSubfolder,
    folderExists,
    folderIsReachable,
    readDocument,
    renameDocument,
    scanFolder,
    SUGGESTED_FOLDER_NAME,
    suggestUntitledName,
    writeDocument,
    writeImage,
    type DocumentLocation,
    type FolderNode
} from '$lib/fs/documents';
import { fromMarkdown } from '$lib/markdown';
import { documentPath } from '$lib/models/document.model';

// These run against OPFS (navigator.storage.getDirectory()), which hands back
// real FileSystemDirectoryHandle objects — the same API the app drives against
// the user's chosen folder. That makes this a genuine test of the save/rename
// ordering rather than an assertion about a mock.

let root: FileSystemDirectoryHandle;

// The harness helpers, bound to this suite's root.
const writeRaw = (folder: string, file: string, text: string) =>
    opfs.writeRaw(root, folder, file, text);
const readFile = (folder: string, file: string) =>
    opfs.readFile(root, folder, file);
const fileExists = (folder: string, file: string) =>
    opfs.fileExists(root, folder, file);

// The shape the app creates for itself: a folder holding one markdown file of
// the same name.
function folderDoc(title: string, folder = title): DocumentLocation {
    return { folder, file: `${title}.md`, ownsFolder: true };
}

// A markdown file the app merely found, sitting among the user's own files.
function fileDoc(folder: string, file: string): DocumentLocation {
    return { folder, file, ownsFolder: false };
}

async function paths(): Promise<string[]> {
    return flattenDocuments(await scanFolder(root)).map(documentPath);
}

function folderNamed(tree: FolderNode, name: string): FolderNode | undefined {
    return tree.folders.find((child) => child.name === name);
}

beforeEach(async () => {
    root = await opfs.emptyRoot();
});

describe('writeDocument', () => {
    it('creates the folder and a markdown file of the same name', async () => {
        const entry = await writeDocument(
            root,
            folderDoc('My Chapter'),
            fromMarkdown('# Hello\n\nSome text.')
        );

        expect(entry.folder).toBe('My Chapter');
        expect(entry.file).toBe('My Chapter.md');
        expect(await readFile('My Chapter', 'My Chapter.md')).toBe(
            '# Hello\n\nSome text.'
        );
    });

    it('overwrites cleanly rather than appending on re-save', async () => {
        await writeDocument(root, folderDoc('Draft'), fromMarkdown('First'));
        await writeDocument(root, folderDoc('Draft'), fromMarkdown('Second'));

        expect(await readFile('Draft', 'Draft.md')).toBe('Second');
    });

    it('writes a document that lives at the root of the working folder', async () => {
        await writeDocument(
            root,
            fileDoc('', 'notes.md'),
            fromMarkdown('Loose note')
        );

        expect(await readFile('', 'notes.md')).toBe('Loose note');
    });

    it('writes a nested document without disturbing its neighbours', async () => {
        await writeRaw('Book/Chapters', 'Two.md', 'two');

        await writeDocument(
            root,
            fileDoc('Book/Chapters', 'One.md'),
            fromMarkdown('one')
        );

        expect(await readFile('Book/Chapters', 'One.md')).toBe('one');
        expect(await readFile('Book/Chapters', 'Two.md')).toBe('two');
    });
});

describe('readDocument', () => {
    it('round-trips a saved document back into the editor model', async () => {
        const md = '## Notes\n\n-   One\n-   Two';
        await writeDocument(root, folderDoc('Notes'), fromMarkdown(md));

        const opened = await readDocument(root, 'Notes/Notes.md');
        expect(opened.title).toBe('Notes');
        expect(opened.contentJson.type).toBe('doc');
    });

    it('opens a bare folder name, as older links still carry', async () => {
        await writeDocument(root, folderDoc('Notes'), fromMarkdown('body'));

        const opened = await readDocument(root, 'Notes');
        expect(opened.file).toBe('Notes.md');
        expect(opened.ownsFolder).toBe(true);
    });

    it('opens a markdown file sitting loose at the root', async () => {
        await writeRaw('', 'notes.md', 'Loose note');

        const opened = await readDocument(root, 'notes.md');
        expect(opened.title).toBe('notes');
        expect(opened.folder).toBe('');
        expect(opened.ownsFolder).toBe(false);
    });

    it('throws a DocumentError for a folder that is not there', async () => {
        await expect(readDocument(root, 'Nope')).rejects.toBeInstanceOf(
            DocumentError
        );
    });

    it('refuses a path that tries to climb out of the working folder', async () => {
        await expect(
            readDocument(root, '../escaped.md')
        ).rejects.toBeInstanceOf(DocumentError);
    });
});

describe('scanFolder', () => {
    it('lists the document folders the app itself creates', async () => {
        await writeDocument(root, folderDoc('Older'), fromMarkdown('a'));
        await writeDocument(root, folderDoc('Newer'), fromMarkdown('b'));

        expect(await paths()).toEqual(['Newer/Newer.md', 'Older/Older.md']);
    });

    it('finds a loose file at the root and a chapter nested below it', async () => {
        await writeRaw('', 'notes.md', 'loose');
        await writeRaw('Book/Chapters', 'One.md', 'one');

        // Both are found wherever they sit. Folders come first in the flattened
        // order, so the nested chapter leads and the loose file follows.
        expect(await paths()).toEqual(['Book/Chapters/One.md', 'notes.md']);
    });

    it('marks a document that owns its folder, and one that does not', async () => {
        await writeRaw('My Chapter', 'My Chapter.md', 'a');
        await writeRaw('Shared', 'Shared.md', 'b');
        await writeRaw('Shared', 'Aside.md', 'c');

        const found = flattenDocuments(await scanFolder(root));
        const owning = found.filter((d) => d.ownsFolder).map(documentPath);

        // Two markdown files in one folder means neither owns it — deleting
        // either must not take the other with it.
        expect(owning).toEqual(['My Chapter/My Chapter.md']);
    });

    it('shows a folder holding one document as that document', async () => {
        await writeRaw('My Chapter', 'My Chapter.md', 'a');

        const tree = await scanFolder(root);

        // The folder is real on disk, but as a row it only repeats the name of
        // the one file inside it.
        expect(tree.folders).toHaveLength(0);
        expect(tree.documents.map(documentPath)).toEqual([
            'My Chapter/My Chapter.md'
        ]);
        expect(tree.documents[0]?.ownsFolder).toBe(true);
    });

    it('keeps a folder holding more than one document', async () => {
        await writeRaw('Shared', 'Shared.md', 'a');
        await writeRaw('Shared', 'Aside.md', 'b');

        const tree = await scanFolder(root);

        expect(folderNamed(tree, 'Shared')?.documents).toHaveLength(2);
        expect(tree.documents).toEqual([]);
    });

    it('keeps every folder in a chain that is one document deep', async () => {
        await writeRaw('Book/Chapters', 'One.md', 'one');

        // `One` is not named after `Chapters`, so nothing here is the folder
        // repeating its file's name — the tree matches the folder on disk.
        const tree = await scanFolder(root);

        expect(tree.documents).toEqual([]);
        const chapters = folderNamed(tree, 'Book');
        expect(
            folderNamed(chapters!, 'Chapters')?.documents.map(documentPath)
        ).toEqual(['Book/Chapters/One.md']);
    });

    it('keeps a folder holding one document not named after it', async () => {
        await writeRaw('Drafts', 'Chapter One.md', 'a');

        // The shape a writer gets from making a folder and filing writing into
        // it. Collapsing it would take away the folder they just made.
        const tree = await scanFolder(root);

        expect(tree.documents).toEqual([]);
        expect(folderNamed(tree, 'Drafts')?.documents).toHaveLength(1);
    });

    it('sorts a lifted document among the documents beside it', async () => {
        await writeRaw('', 'Beta.md', 'b');
        await writeRaw('Alpha', 'Alpha.md', 'a');
        await writeRaw('Zeta', 'Zeta.md', 'z');

        const tree = await scanFolder(root);

        expect(tree.documents.map((d) => d.title)).toEqual([
            'Alpha',
            'Beta',
            'Zeta'
        ]);
    });

    it('does not let a folder with a subdirectory be owned', async () => {
        await writeRaw('Book', 'Book.md', 'a');
        await writeRaw('Book/Notes', 'Aside.md', 'b');

        const found = flattenDocuments(await scanFolder(root));
        expect(found.find((d) => d.file === 'Book.md')?.ownsFolder).toBe(false);
    });

    it('keeps an empty folder, which is very often one just made', async () => {
        await root.getDirectoryHandle('Drafts', { create: true });

        // A folder made from the Files screen and left empty has to survive the
        // rescan that follows, or it is gone the moment the writer looks away.
        expect(folderNamed(await scanFolder(root), 'Drafts')).toBeDefined();
    });

    it('keeps a folder holding only files it cannot open', async () => {
        await writeRaw('Scans', 'page-one.jpg', 'x');

        const tree = await scanFolder(root);

        // Shown, because it is the user's — and flagged, so the row can say
        // "nothing we can open" rather than "nothing in here".
        expect(folderNamed(tree, 'Scans')?.hasOtherEntries).toBe(true);
        expect(flattenDocuments(tree)).toEqual([]);
    });

    it('skips dot-directories and non-markdown files', async () => {
        await writeRaw('.obsidian', 'workspace.md', 'x');
        await writeRaw('', 'config.json', '{}');

        expect(await paths()).toEqual([]);
    });

    it('stops at the depth cap and loads the rest on demand', async () => {
        await writeRaw('a/b/c/d', 'Deep.md', 'deep');

        const tree = await scanFolder(root);
        const a = folderNamed(tree, 'a');
        const b = a && folderNamed(a, 'b');
        const c = b && folderNamed(b, 'c');
        const d = c && folderNamed(c, 'd');

        // Three levels below the root is as far as the first scan walks, so `d`
        // is known to exist but nothing inside it is.
        expect(c?.loaded).toBe(true);
        expect(d?.loaded).toBe(false);
        expect(flattenDocuments(tree)).toEqual([]);

        // Expanding it is what goes and looks.
        const loaded = await scanFolder(root, { path: 'a/b/c/d' });
        expect(loaded.loaded).toBe(true);
        expect(flattenDocuments(loaded).map(documentPath)).toEqual([
            'a/b/c/d/Deep.md'
        ]);
    });
});

// A folder showing no documents is two very different situations, and the Files
// screen has to tell them apart: one is empty, the other is full of the user's
// work in formats this app cannot open. Saying "nothing here yet" about the
// second reads as if the app threw it away.
describe('scanFolder — a folder that changes under it', () => {
    // The folder is live. The app's own rename removes the old name a moment
    // after writing the new one, and the writer's own tools — a file manager, a
    // sync client — are under no obligation to hold still either. A scan that
    // failed whole for one vanished entry told the writer their folder had moved
    // when it had not.
    it('drops a file removed mid-walk rather than failing the scan', async () => {
        for (let i = 0; i < 30; i += 1) {
            await writeRaw('', `doc-${i}.md`, 'x'.repeat(500));
        }

        // Started, then interrupted after the listing and before the files are
        // read — the window the rename lands in.
        const scan = scanFolder(root);
        await Promise.resolve();
        await root.removeEntry('doc-15.md');

        const found = (await scan).documents.map(documentPath);

        expect(found).not.toContain('doc-15.md');
        expect(found).toHaveLength(29);
    });

    it('drops a folder removed mid-walk rather than failing the scan', async () => {
        for (let i = 0; i < 30; i += 1) {
            await writeRaw(`folder-${i}`, 'chapter.md', 'x'.repeat(500));
        }

        const scan = scanFolder(root);
        await Promise.resolve();
        await root.removeEntry('folder-15', { recursive: true });

        const tree = await scan;

        expect(folderNamed(tree, 'folder-15')).toBeUndefined();
        expect(tree.folders).toHaveLength(29);
    });

    it('renaming a file-document under a scan leaves the scan standing', async () => {
        for (let i = 0; i < 30; i += 1) {
            await writeRaw('Shared', `doc-${i}.md`, 'x'.repeat(500));
        }

        const scan = scanFolder(root);
        const renamed = renameDocument(
            root,
            fileDoc('Shared', 'doc-15.md'),
            'Renamed'
        );

        await expect(scan).resolves.toBeDefined();
        await renamed;

        // And the scan that follows the rename — the one the screen renders from
        // — sees the new name.
        expect(await paths()).toContain('Shared/Renamed.md');
    });
});

describe('scanFolder — hasOtherEntries', () => {
    it('is false for a genuinely empty folder', async () => {
        expect((await scanFolder(root)).hasOtherEntries).toBe(false);
    });

    it('is false for a folder holding nothing but config.json', async () => {
        // The app wrote it, so it is not content the user put there.
        await writeRaw('', 'config.json', '{}');

        expect((await scanFolder(root)).hasOtherEntries).toBe(false);
    });

    it('is true for a folder of files the app cannot open', async () => {
        await writeRaw('', 'Chapter One.docx', 'x');
        await writeRaw('', 'cover.png', 'y');

        const tree = await scanFolder(root);

        expect(flattenDocuments(tree)).toEqual([]);
        expect(tree.hasOtherEntries).toBe(true);
    });

    it('carries up from a subfolder holding no writing', async () => {
        await writeRaw('Scans', 'page-one.jpg', 'x');

        const tree = await scanFolder(root);

        // `Scans` keeps its row, and what is inside it still has to reach the
        // root: the empty state asks the root alone whether the scan saw
        // anything it could not show.
        expect(tree.folders).toHaveLength(1);
        expect(tree.hasOtherEntries).toBe(true);
    });

    it('is false when everything present is a document', async () => {
        await writeRaw('', 'notes.md', 'a');
        await writeRaw('Book/Chapters', 'One.md', 'b');

        expect((await scanFolder(root)).hasOtherEntries).toBe(false);
    });

    it('is false for an unloaded folder, which has not been looked at', async () => {
        await writeRaw('a/b/c/d', 'Deep.md', 'deep');

        const tree = await scanFolder(root);
        const a = folderNamed(tree, 'a');
        const b = a && folderNamed(a, 'b');
        const c = b && folderNamed(b, 'c');
        const d = c && folderNamed(c, 'd');

        // Nothing has been looked at inside `d`, so nothing there is known to be
        // unshowable — and the folder is shown either way.
        expect(d?.loaded).toBe(false);
        expect(d?.hasOtherEntries).toBe(false);
    });
});

describe('renameDocument', () => {
    it('moves the folder AND the markdown file inside it', async () => {
        await writeDocument(
            root,
            folderDoc('Old Name'),
            fromMarkdown('Body text')
        );

        const entry = await renameDocument(
            root,
            folderDoc('Old Name'),
            'New Name'
        );

        expect(entry.folder).toBe('New Name');
        expect(entry.file).toBe('New Name.md');
        expect(await folderExists(root, 'Old Name')).toBe(false);
        expect(await readFile('New Name', 'New Name.md')).toBe('Body text');
    });

    it('carries the document images along with it', async () => {
        await writeDocument(root, folderDoc('Illustrated'), fromMarkdown('t'));
        await writeImage(
            root,
            'Illustrated',
            new File(['png-bytes'], 'diagram.png', { type: 'image/png' })
        );

        await renameDocument(root, folderDoc('Illustrated'), 'Renamed');

        expect(await readFile('Renamed', 'diagram.png')).toBe('png-bytes');
    });

    it('keeps a nested folder-document inside its own parent', async () => {
        await writeRaw('Book/Chapter One', 'Chapter One.md', 'one');

        const entry = await renameDocument(
            root,
            folderDoc('Chapter One', 'Book/Chapter One'),
            'Chapter Two'
        );

        expect(entry.folder).toBe('Book/Chapter Two');
        expect(await readFile('Book/Chapter Two', 'Chapter Two.md')).toBe(
            'one'
        );
        expect(await folderExists(root, 'Book/Chapter One')).toBe(false);
    });

    it('renames only the file when the document does not own its folder', async () => {
        await writeRaw('Notes', 'One.md', 'one');
        await writeRaw('Notes', 'Two.md', 'two');

        const entry = await renameDocument(
            root,
            fileDoc('Notes', 'One.md'),
            'Renamed'
        );

        expect(entry.folder).toBe('Notes');
        expect(entry.file).toBe('Renamed.md');
        expect(await readFile('Notes', 'Renamed.md')).toBe('one');
        expect(await fileExists('Notes', 'One.md')).toBe(false);
        // The folder and the neighbour are the user's, not this document's.
        expect(await readFile('Notes', 'Two.md')).toBe('two');
    });

    it('refuses to clobber an existing document of that name', async () => {
        await writeDocument(root, folderDoc('One'), fromMarkdown('one'));
        await writeDocument(root, folderDoc('Two'), fromMarkdown('two'));

        await expect(
            renameDocument(root, folderDoc('One'), 'Two')
        ).rejects.toBeInstanceOf(DocumentError);

        // Crucially, the source must survive a refused rename.
        expect(await readFile('One', 'One.md')).toBe('one');
        expect(await readFile('Two', 'Two.md')).toBe('two');
    });

    it('refuses to clobber a neighbouring file of that name', async () => {
        await writeRaw('Notes', 'One.md', 'one');
        await writeRaw('Notes', 'Two.md', 'two');

        await expect(
            renameDocument(root, fileDoc('Notes', 'One.md'), 'Two')
        ).rejects.toBeInstanceOf(DocumentError);

        expect(await readFile('Notes', 'One.md')).toBe('one');
        expect(await readFile('Notes', 'Two.md')).toBe('two');
    });

    it('sanitises a title that would escape the folder', async () => {
        await writeDocument(root, folderDoc('Safe'), fromMarkdown('x'));

        const entry = await renameDocument(
            root,
            folderDoc('Safe'),
            '../escaped'
        );

        expect(entry.folder).toBe('escaped');
        expect(await folderExists(root, 'escaped')).toBe(true);
    });

    // `ownsFolder` reaches rename as a snapshot — from the moment the document
    // was opened. The folder-document path ends in a RECURSIVE removeEntry after
    // copying files only, so anything that appeared in between would be destroyed
    // unread. The directory itself is asked again before that happens.
    it('renames only the file when the folder has gained a subdirectory', async () => {
        await writeDocument(root, folderDoc('Chapter'), fromMarkdown('body'));
        // The writer, a file manager or a sync client, after the last scan.
        await writeRaw('Chapter/Drafts', 'earlier.md', 'earlier');

        const entry = await renameDocument(
            root,
            folderDoc('Chapter'),
            'Renamed'
        );

        // Corrected, not refused: this is what a fresh scan would have made it do.
        expect(entry.ownsFolder).toBe(false);
        expect(entry.folder).toBe('Chapter');
        expect(entry.file).toBe('Renamed.md');
        expect(await readFile('Chapter', 'Renamed.md')).toBe('body');
        expect(await fileExists('Chapter', 'Chapter.md')).toBe(false);
        // The whole point: nothing was removed recursively.
        expect(await readFile('Chapter/Drafts', 'earlier.md')).toBe('earlier');
    });

    it('renames only the file when a second document has appeared beside it', async () => {
        await writeDocument(root, folderDoc('Chapter'), fromMarkdown('body'));
        await writeRaw('Chapter', 'Notes.md', 'notes');

        const entry = await renameDocument(
            root,
            folderDoc('Chapter'),
            'Renamed'
        );

        expect(entry.ownsFolder).toBe(false);
        expect(await readFile('Chapter', 'Renamed.md')).toBe('body');
        expect(await readFile('Chapter', 'Notes.md')).toBe('notes');
    });
});

describe('writeImage', () => {
    it('writes into the document folder and returns a relative name', async () => {
        await writeDocument(root, folderDoc('Doc'), fromMarkdown('x'));

        const name = await writeImage(
            root,
            'Doc',
            new File(['bytes'], 'photo.png', { type: 'image/png' })
        );

        expect(name).toBe('photo.png');
        expect(name).not.toContain('/');
        expect(await readFile('Doc', 'photo.png')).toBe('bytes');
    });

    it('writes beside a document that has no folder of its own', async () => {
        await writeRaw('Notes', 'One.md', 'one');

        const name = await writeImage(
            root,
            'Notes',
            new File(['bytes'], 'photo.png', { type: 'image/png' })
        );

        expect(await readFile('Notes', name)).toBe('bytes');
    });

    it('never overwrites an existing image', async () => {
        await writeDocument(root, folderDoc('Doc'), fromMarkdown('x'));
        const file = () =>
            new File(['bytes'], 'photo.png', { type: 'image/png' });

        expect(await writeImage(root, 'Doc', file())).toBe('photo.png');
        expect(await writeImage(root, 'Doc', file())).toBe('photo-2.png');
    });
});

describe('deleteDocument', () => {
    it('removes the folder and everything in it', async () => {
        await writeDocument(root, folderDoc('Doomed'), fromMarkdown('x'));
        await writeImage(
            root,
            'Doomed',
            new File(['b'], 'img.png', { type: 'image/png' })
        );

        await deleteDocument(root, folderDoc('Doomed'));

        expect(await folderExists(root, 'Doomed')).toBe(false);
    });

    it('removes only the file when the document does not own its folder', async () => {
        await writeRaw('Notes', 'One.md', 'one');
        await writeRaw('Notes', 'Two.md', 'two');

        await deleteDocument(root, fileDoc('Notes', 'One.md'));

        expect(await fileExists('Notes', 'One.md')).toBe(false);
        expect(await readFile('Notes', 'Two.md')).toBe('two');
    });

    // Where rename can carry on under a corrected flag, delete cannot: there is
    // no trash behind `removeEntry({ recursive: true })`, and the writer confirmed
    // against copy naming a folder that no longer describes what is in there.
    it('refuses when the folder has gained a subdirectory since the scan', async () => {
        await writeDocument(root, folderDoc('Doomed'), fromMarkdown('body'));
        await writeRaw('Doomed/Drafts', 'earlier.md', 'earlier');

        await expect(
            deleteDocument(root, folderDoc('Doomed'))
        ).rejects.toBeInstanceOf(DocumentError);

        // Nothing at all was removed.
        expect(await readFile('Doomed', 'Doomed.md')).toBe('body');
        expect(await readFile('Doomed/Drafts', 'earlier.md')).toBe('earlier');
    });

    // Stricter than the scan on purpose: `listDirectory` skips dot-entries, which
    // is right when walking for documents and wrong here, because a recursive
    // remove takes them regardless.
    it('refuses over a dot-directory the scan would have skipped', async () => {
        await writeDocument(root, folderDoc('Doomed'), fromMarkdown('body'));
        await writeRaw('Doomed/.versions', 'old.md', 'old');

        await expect(
            deleteDocument(root, folderDoc('Doomed'))
        ).rejects.toBeInstanceOf(DocumentError);

        expect(await readFile('Doomed/.versions', 'old.md')).toBe('old');
    });

    it('refuses when a second document has appeared in the folder', async () => {
        await writeDocument(root, folderDoc('Doomed'), fromMarkdown('body'));
        await writeRaw('Doomed', 'Notes.md', 'notes');

        await expect(
            deleteDocument(root, folderDoc('Doomed'))
        ).rejects.toBeInstanceOf(DocumentError);

        expect(await readFile('Doomed', 'Notes.md')).toBe('notes');
    });

    // The re-check must not be so strict it refuses a genuine folder-document.
    it('still deletes a folder holding only the document and its images', async () => {
        await writeDocument(root, folderDoc('Doomed'), fromMarkdown('x'));
        await writeImage(
            root,
            'Doomed',
            new File(['b'], 'img.png', { type: 'image/png' })
        );

        await deleteDocument(root, folderDoc('Doomed'));

        expect(await folderExists(root, 'Doomed')).toBe(false);
    });
});

describe('createFolder', () => {
    it('creates a folder at the root and inside another', async () => {
        expect(await createFolder(root, '', 'Drafts')).toBe('Drafts');
        expect(await createFolder(root, 'Drafts', 'Chapters')).toBe(
            'Drafts/Chapters'
        );

        expect(await folderExists(root, 'Drafts/Chapters')).toBe(true);
    });

    it('refuses a folder that is already there rather than adopting it', async () => {
        await writeRaw('Chapters', 'One.md', 'one');

        // The difference from ensureSubfolder, which reuses on purpose. Silently
        // adopting somebody's existing "Chapters" is not what was asked for.
        await expect(createFolder(root, '', 'Chapters')).rejects.toThrow(
            DocumentError
        );
        expect(await readFile('Chapters', 'One.md')).toBe('one');
    });

    it('refuses a name a file already holds', async () => {
        await writeRaw('', 'notes.md', 'a');

        await expect(createFolder(root, '', 'notes.md')).rejects.toThrow(
            DocumentError
        );
    });

    it('sanitises a name that would escape the folder', async () => {
        const path = await createFolder(root, '', '../../etc');

        expect(path).toBe('etc');
        expect(await folderExists(root, 'etc')).toBe(true);
    });
});

describe('deleteFolder', () => {
    it('removes an empty folder', async () => {
        await createFolder(root, '', 'Drafts');

        await deleteFolder(root, 'Drafts');

        expect(await folderExists(root, 'Drafts')).toBe(false);
    });

    it('leaves a folder with anything in it completely alone', async () => {
        await writeRaw('Chapters', 'One.md', 'one');

        // removeEntry WITHOUT recursive is what refuses this — the browser is
        // the safety here, not the UI that decides when to offer the action.
        await expect(deleteFolder(root, 'Chapters')).rejects.toThrow(
            DocumentError
        );
        expect(await readFile('Chapters', 'One.md')).toBe('one');
    });
});

describe('createDocument', () => {
    // Every document the app creates owns its folder, wherever it is made —
    // images belong to the document that uses them, and only a folder of its own
    // can hold them.
    it('gives the document a folder of its own inside the folder chosen', async () => {
        await createFolder(root, '', 'Drafts');

        const entry = await createDocument(root, 'Drafts', 'Chapter One');

        expect(entry.folder).toBe('Drafts/Chapter One');
        expect(entry.file).toBe('Chapter One.md');
        expect(entry.ownsFolder).toBe(true);
        expect(await fileExists('Drafts/Chapter One', 'Chapter One.md')).toBe(
            true
        );
        // Not left flat beside its siblings, where its images would be shared.
        expect(await fileExists('Drafts', 'Chapter One.md')).toBe(false);
    });

    it('shows up in the next scan as ONE row, inside the folder it was made in', async () => {
        await createFolder(root, '', 'Drafts');
        await createDocument(root, 'Drafts', 'Chapter One');

        // `onlyDocument` collapses `X/X.md` into its parent, so the Files screen
        // is unchanged by the nesting: one document row under Drafts, and no
        // disclosure to open first.
        const tree = await scanFolder(root);
        const drafts = folderNamed(tree, 'Drafts');
        expect(drafts?.documents.map(documentPath)).toEqual([
            'Drafts/Chapter One/Chapter One.md'
        ]);
        expect(drafts?.folders).toEqual([]);
    });

    it('keeps its images to itself', async () => {
        await createFolder(root, '', 'Drafts');
        await writeRaw('Drafts', 'Sibling.md', 'sibling');
        const entry = await createDocument(root, 'Drafts', 'Chapter One');

        await writeImage(
            root,
            entry.folder,
            new File(['png'], 'diagram.png', { type: 'image/png' })
        );

        expect(await readFile('Drafts/Chapter One', 'diagram.png')).toBe('png');
        expect(await fileExists('Drafts', 'diagram.png')).toBe(false);
    });

    it('refuses a name already held by a markdown file', async () => {
        await writeRaw('Notes', 'One.md', 'one');

        await expect(createDocument(root, 'Notes', 'One')).rejects.toThrow(
            DocumentError
        );
        expect(await readFile('Notes', 'One.md')).toBe('one');
    });

    // New with the nesting: the name now claims a directory too, so a folder
    // already sitting there is a collision it never used to be.
    it('refuses a name already held by a directory, touching nothing in it', async () => {
        await writeRaw('Notes/One', 'whatever.md', 'theirs');

        await expect(createDocument(root, 'Notes', 'One')).rejects.toThrow(
            DocumentError
        );
        expect(await readFile('Notes/One', 'whatever.md')).toBe('theirs');
    });
});

describe('suggestUntitledName', () => {
    it('starts at Untitled and increments past what exists', async () => {
        expect(await suggestUntitledName(root)).toBe('Untitled');

        await writeDocument(root, folderDoc('Untitled'), fromMarkdown('x'));
        expect(await suggestUntitledName(root)).toBe('Untitled 2');

        await writeDocument(root, folderDoc('Untitled 2'), fromMarkdown('x'));
        expect(await suggestUntitledName(root)).toBe('Untitled 3');
    });
});

// The welcome screen's "start a new folder" card. The picker cannot be pointed
// at a path, so the folder is made inside whatever the user picks.
describe('ensureSubfolder', () => {
    it('creates the folder when it is not there', async () => {
        expect(await folderExists(root, SUGGESTED_FOLDER_NAME)).toBe(false);

        const handle = await ensureSubfolder(root, SUGGESTED_FOLDER_NAME);

        expect(handle.name).toBe(SUGGESTED_FOLDER_NAME);
        expect(await folderExists(root, SUGGESTED_FOLDER_NAME)).toBe(true);
    });

    // A second run has to land back in the user's writing, not beside it.
    it('reuses an existing folder without touching what is in it', async () => {
        await writeRaw(SUGGESTED_FOLDER_NAME, 'Chapter.md', '# Chapter');

        await ensureSubfolder(root, SUGGESTED_FOLDER_NAME);

        expect(await fileExists(SUGGESTED_FOLDER_NAME, 'Chapter.md')).toBe(
            true
        );
        expect(await readFile(SUGGESTED_FOLDER_NAME, 'Chapter.md')).toBe(
            '# Chapter'
        );
    });
});

// A stored handle outlives the folder it names, and the browser will grant
// permission for something that is no longer there — so the welcome screen's
// "reopen" card has to ask the folder itself before committing to it.
describe('folderIsReachable', () => {
    it('is true for a folder that is still there', async () => {
        const handle = await ensureSubfolder(root, 'Writing');

        expect(await folderIsReachable(handle)).toBe(true);
    });

    it('is false once the folder has gone', async () => {
        const handle = await ensureSubfolder(root, 'Writing');
        await root.removeEntry('Writing', { recursive: true });

        expect(await folderIsReachable(handle)).toBe(false);
    });
});

// A file written by another tool may open with a `---` fence. It has to come back
// out of a read-then-write byte for byte: this is the user's metadata, and there is
// no undo for silently rewriting it into the prose.
describe('frontmatter', () => {
    const FENCED = [
        '---',
        'title: My Chapter',
        'date: 2026-08-14',
        'tags: [draft]',
        '---',
        '',
        '# Chapter One',
        '',
        'Some prose.'
    ].join('\n');

    it('survives opening a document and saving it again', async () => {
        await writeRaw('Fenced', 'Fenced.md', FENCED);

        const opened = await readDocument(root, 'Fenced/Fenced.md');
        expect(opened.frontmatter).toEqual({
            title: 'My Chapter',
            date: '2026-08-14',
            tags: ['draft']
        });

        await writeDocument(
            root,
            {
                folder: opened.folder,
                file: opened.file,
                ownsFolder: opened.ownsFolder
            },
            opened.contentJson,
            opened.frontmatter
        );

        const saved = await readFile('Fenced', 'Fenced.md');
        expect(saved).toContain('title: My Chapter');
        // A bare date must not come back as an ISO timestamp.
        expect(saved).toContain('date: 2026-08-14');
        expect(saved).toContain('# Chapter One');
        // And it must still be frontmatter, not a heading in the prose.
        expect(saved.startsWith('---\n')).toBe(true);
    });

    it('keeps the metadata out of the editor content', async () => {
        await writeRaw('Fenced', 'Fenced.md', FENCED);

        const opened = await readDocument(root, 'Fenced/Fenced.md');

        expect(JSON.stringify(opened.contentJson)).not.toContain('title:');
    });

    it('does not give a document without frontmatter a fence', async () => {
        await writeDocument(root, folderDoc('Plain'), fromMarkdown('# Hello'));

        expect(await readFile('Plain', 'Plain.md')).toBe('# Hello');
    });
});
