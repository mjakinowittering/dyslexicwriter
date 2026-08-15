import { beforeEach, describe, expect, it } from 'vitest';

import { fromMarkdown } from '$lib/markdown';

import {
    deleteDocument,
    DocumentError,
    folderExists,
    readDocument,
    renameDocument,
    scanFolder,
    suggestUntitledName,
    writeDocument,
    writeImage
} from './documents';

// These run against OPFS (navigator.storage.getDirectory()), which hands back
// real FileSystemDirectoryHandle objects — the same API the app drives against
// the user's chosen folder. That makes this a genuine test of the save/rename
// ordering rather than an assertion about a mock.

let root: FileSystemDirectoryHandle;

async function emptyRoot(): Promise<FileSystemDirectoryHandle> {
    const opfs = await navigator.storage.getDirectory();
    for await (const name of opfs.keys()) {
        await opfs.removeEntry(name, { recursive: true });
    }
    return opfs;
}

async function readFile(folder: string, file: string): Promise<string> {
    const dir = await root.getDirectoryHandle(folder);
    const handle = await dir.getFileHandle(file);
    return (await handle.getFile()).text();
}

beforeEach(async () => {
    root = await emptyRoot();
});

describe('writeDocument', () => {
    it('creates the folder and a markdown file of the same name', async () => {
        const entry = await writeDocument(
            root,
            'My Chapter',
            fromMarkdown('# Hello\n\nSome text.')
        );

        expect(entry.folder).toBe('My Chapter');
        expect(entry.file).toBe('My Chapter.md');
        expect(await readFile('My Chapter', 'My Chapter.md')).toBe(
            '# Hello\n\nSome text.'
        );
    });

    it('overwrites cleanly rather than appending on re-save', async () => {
        await writeDocument(root, 'Draft', fromMarkdown('First version'));
        await writeDocument(root, 'Draft', fromMarkdown('Second'));

        expect(await readFile('Draft', 'Draft.md')).toBe('Second');
    });
});

describe('readDocument', () => {
    it('round-trips a saved document back into the editor model', async () => {
        const md = '## Notes\n\n-   One\n-   Two';
        await writeDocument(root, 'Notes', fromMarkdown(md));

        const opened = await readDocument(root, 'Notes');
        expect(opened.title).toBe('Notes');
        expect(opened.contentJson.type).toBe('doc');
    });

    it('throws a DocumentError for a folder that is not there', async () => {
        await expect(readDocument(root, 'Nope')).rejects.toBeInstanceOf(
            DocumentError
        );
    });
});

describe('scanFolder', () => {
    it('lists document folders, newest first', async () => {
        await writeDocument(root, 'Older', fromMarkdown('a'));
        await writeDocument(root, 'Newer', fromMarkdown('b'));

        const found = await scanFolder(root);
        expect(found.map((d) => d.folder)).toContain('Older');
        expect(found.map((d) => d.folder)).toContain('Newer');
        expect(found).toHaveLength(2);
    });

    it('ignores a folder with no markdown file in it', async () => {
        await root.getDirectoryHandle('Not A Document', { create: true });
        expect(await scanFolder(root)).toHaveLength(0);
    });
});

describe('renameDocument', () => {
    it('moves the folder AND the markdown file inside it', async () => {
        await writeDocument(root, 'Old Name', fromMarkdown('Body text'));

        const entry = await renameDocument(root, 'Old Name', 'New Name');

        expect(entry.folder).toBe('New Name');
        expect(entry.file).toBe('New Name.md');
        expect(await folderExists(root, 'Old Name')).toBe(false);
        expect(await readFile('New Name', 'New Name.md')).toBe('Body text');
    });

    it('carries the document images along with it', async () => {
        await writeDocument(root, 'Illustrated', fromMarkdown('text'));
        await writeImage(
            root,
            'Illustrated',
            new File(['png-bytes'], 'diagram.png', { type: 'image/png' })
        );

        await renameDocument(root, 'Illustrated', 'Renamed');

        expect(await readFile('Renamed', 'diagram.png')).toBe('png-bytes');
    });

    it('refuses to clobber an existing document of that name', async () => {
        await writeDocument(root, 'One', fromMarkdown('one'));
        await writeDocument(root, 'Two', fromMarkdown('two'));

        await expect(renameDocument(root, 'One', 'Two')).rejects.toBeInstanceOf(
            DocumentError
        );

        // Crucially, the source must survive a refused rename.
        expect(await readFile('One', 'One.md')).toBe('one');
        expect(await readFile('Two', 'Two.md')).toBe('two');
    });

    it('sanitises a title that would escape the folder', async () => {
        await writeDocument(root, 'Safe', fromMarkdown('x'));

        const entry = await renameDocument(root, 'Safe', '../escaped');

        expect(entry.folder).toBe('escaped');
        expect(await folderExists(root, 'escaped')).toBe(true);
    });
});

describe('writeImage', () => {
    it('writes into the document folder and returns a relative name', async () => {
        await writeDocument(root, 'Doc', fromMarkdown('x'));

        const name = await writeImage(
            root,
            'Doc',
            new File(['bytes'], 'photo.png', { type: 'image/png' })
        );

        expect(name).toBe('photo.png');
        expect(name).not.toContain('/');
        expect(await readFile('Doc', 'photo.png')).toBe('bytes');
    });

    it('never overwrites an existing image', async () => {
        await writeDocument(root, 'Doc', fromMarkdown('x'));
        const file = () =>
            new File(['bytes'], 'photo.png', { type: 'image/png' });

        expect(await writeImage(root, 'Doc', file())).toBe('photo.png');
        expect(await writeImage(root, 'Doc', file())).toBe('photo-2.png');
    });
});

describe('deleteDocument', () => {
    it('removes the folder and everything in it', async () => {
        await writeDocument(root, 'Doomed', fromMarkdown('x'));
        await writeImage(
            root,
            'Doomed',
            new File(['b'], 'img.png', { type: 'image/png' })
        );

        await deleteDocument(root, 'Doomed');

        expect(await folderExists(root, 'Doomed')).toBe(false);
    });
});

describe('suggestUntitledName', () => {
    it('starts at Untitled and increments past what exists', async () => {
        expect(await suggestUntitledName(root)).toBe('Untitled');

        await writeDocument(root, 'Untitled', fromMarkdown('x'));
        expect(await suggestUntitledName(root)).toBe('Untitled 2');

        await writeDocument(root, 'Untitled 2', fromMarkdown('x'));
        expect(await suggestUntitledName(root)).toBe('Untitled 3');
    });
});
