import * as opfs from '../../support/opfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fromMarkdown } from '$lib/markdown';
import {
    AUTOSAVE_DEBOUNCE_MS,
    AUTOSAVE_MAX_WAIT_MS,
    doc
} from '$lib/stores/document.svelte';
import { workspace } from '$lib/stores/workspace.svelte';

// The autosave lifecycle, against a real filesystem.
//
// This store holds the only copy of the user's work while a document is open, so
// what is under test is not "does it save" but "can an edit ever be dropped": the
// debounce collapsing to one write, a flush cancelling the pending timer, a failed
// write leaving the document dirty so the next attempt retries it, and the reset
// between documents that stops one document's pending write — or its frontmatter —
// landing in the next.
//
// Nothing here is mocked. `workspace.root` is public state, so the test points it
// at an OPFS root and every write underneath is a real write.

const nativeCreateWritable = FileSystemFileHandle.prototype.createWritable;

let root: FileSystemDirectoryHandle;
let opened: string[] = [];

// Markdown writes only: config.json goes through the same call, and the workspace
// rewrites its index after every save.
const documentWrites = () => opened.filter((name) => name.endsWith('.md'));

// Files a test put on disk to arrange itself are not writes under test.
const ignoreFixtureWrites = () => {
    opened.length = 0;
};

const readFile = (folder: string, file: string) =>
    opfs.readFile(root, folder, file);

// A JSONContent that round-trips back to exactly this markdown.
const content = (markdown: string) => fromMarkdown(markdown);

beforeEach(async () => {
    root = await opfs.emptyRoot();
    workspace.root = root;
    // A tree left over from another test would make `touch()` think it already
    // knows this document.
    workspace.tree = null;

    opened = [];
    vi.spyOn(
        FileSystemFileHandle.prototype,
        'createWritable'
    ).mockImplementation(function (
        this: FileSystemFileHandle,
        options?: FileSystemCreateWritableOptions
    ) {
        opened.push(this.name);
        return nativeCreateWritable.call(this, options);
    });

    vi.useFakeTimers();
});

afterEach(async () => {
    // Flush and clear, so a pending write can never cross into the next test.
    await doc.close();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('autosave', () => {
    it('collapses rapid edits into a single write', async () => {
        await doc.createNew();

        doc.applyEdit(content('First'));
        doc.applyEdit(content('Second'));

        await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
        await vi.waitFor(() => expect(doc.saveState).toBe('saved'));

        expect(documentWrites()).toHaveLength(1);
        expect(await readFile('Untitled', 'Untitled.md')).toBe('Second');
    });

    it('does not write before the debounce has elapsed', async () => {
        await doc.createNew();
        doc.applyEdit(content('Mid-sentence'));

        await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS - 1);

        expect(documentWrites()).toHaveLength(0);
        expect(doc.isDirty).toBe(true);
    });

    it('records when the write landed, and clears it on the next document', async () => {
        await doc.createNew();
        expect(doc.savedAt).toBeNull();

        doc.applyEdit(content('Timed'));
        await doc.flush();

        // The status bar ages this to tell the writer how stale the disk copy is,
        // so it has to be the moment of the write and not of the keystroke.
        expect(doc.savedAt).toBeGreaterThan(0);

        // A different document has its own save history — never the last one's.
        await doc.createNew();
        expect(doc.savedAt).toBeNull();
    });

    it('writes during unbroken typing rather than waiting for a pause', async () => {
        await doc.createNew();

        // A keystroke every five seconds for the length of the ceiling — a
        // realistic writing pace, and never once a gap long enough to satisfy the
        // debounce. On the debounce alone this loop performs no writes at all: the
        // deadline moves every time it is approached. That is the failure this
        // guards, and it scales with however long the writer stays in flow.
        for (
            let elapsed = 0;
            elapsed < AUTOSAVE_MAX_WAIT_MS;
            elapsed += 5_000
        ) {
            doc.applyEdit(content(`Sentence ${elapsed}`));
            await vi.advanceTimersByTimeAsync(5_000);
        }

        await vi.waitFor(() => expect(documentWrites()).not.toHaveLength(0));
    });

    it('reports unsaved edits for the whole debounce window', async () => {
        await doc.createNew();
        // Nothing has happened yet, so the bar has nothing to say.
        expect(doc.saveState).toBe('idle');

        doc.applyEdit(content('Mid-sentence'));

        // `pending` is what the status bar renders the unsaved marker from. It has
        // to be true the instant the key is pressed and stay true for the whole
        // wait — `#dirty` is private and unobservable, so a state left on 'idle'
        // here is the whole debounce spent with the bar claiming there is nothing
        // to report.
        expect(doc.saveState).toBe('pending');

        await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS - 1);
        expect(doc.saveState).toBe('pending');

        await vi.advanceTimersByTimeAsync(1);
        await vi.waitFor(() => expect(doc.saveState).toBe('saved'));
    });

    it('creates the folder-document shape on the first save', async () => {
        await doc.createNew();
        doc.applyEdit(content('# Chapter One'));

        await doc.flush();

        expect(doc.location).toEqual({
            folder: 'Untitled',
            file: 'Untitled.md',
            ownsFolder: true
        });
        expect(await readFile('Untitled', 'Untitled.md')).toBe('# Chapter One');
    });
});

describe('flush', () => {
    it('cancels the pending timer and writes exactly once', async () => {
        await doc.createNew();
        doc.applyEdit(content('Closing the tab'));

        await doc.flush();
        expect(documentWrites()).toHaveLength(1);

        // The debounce that was already scheduled must not fire a second write.
        await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 2);
        expect(documentWrites()).toHaveLength(1);
    });

    it('is a no-op on a clean document', async () => {
        await doc.createNew();

        await doc.flush();

        expect(documentWrites()).toHaveLength(0);
        expect(doc.saveState).toBe('idle');
    });

    it('is a no-op on a document that has just been saved', async () => {
        await doc.createNew();
        doc.applyEdit(content('Saved once'));
        await doc.flush();

        await doc.flush();

        expect(documentWrites()).toHaveLength(1);
    });
});

describe('a failed write', () => {
    // A real failure rather than a mocked one: `Blocked` is a plain file, so
    // asking for a directory of that name throws the way a vanished folder or a
    // revoked permission does.
    async function blockTheLocation(): Promise<void> {
        await opfs.writeRaw(root, '', 'Blocked', 'not a directory');
        doc.location = {
            folder: 'Blocked',
            file: 'Blocked.md',
            ownsFolder: true
        };
    }

    it('leaves the document dirty rather than swallowing the edit', async () => {
        await doc.createNew();
        await blockTheLocation();

        doc.applyEdit(content('Precious'));
        await doc.flush();

        expect(doc.saveState).toBe('error');
        expect(doc.error).not.toBe('');
        // Still dirty: the next flush, or the next keystroke, retries.
        expect(doc.isDirty).toBe(true);
    });

    it('still has the edit to write once the location works again', async () => {
        await doc.createNew();
        await blockTheLocation();

        doc.applyEdit(content('Precious'));
        await doc.flush();

        doc.location = {
            folder: 'Recovered',
            file: 'Recovered.md',
            ownsFolder: true
        };
        await doc.flush();

        expect(doc.saveState).toBe('saved');
        expect(doc.isDirty).toBe(false);
        expect(await readFile('Recovered', 'Recovered.md')).toBe('Precious');
    });
});

describe('switching documents', () => {
    beforeEach(async () => {
        // Two documents already on disk, one of them carrying frontmatter the app
        // must preserve without ever letting it reach another file.
        await opfs.writeRaw(
            root,
            'Alpha',
            'Alpha.md',
            '---\ntitle: Alpha\ntags: [draft]\n---\n\nAlpha body\n'
        );
        await opfs.writeRaw(root, 'Bravo', 'Bravo.md', 'Bravo body');
        ignoreFixtureWrites();
    });

    it('reports how current a document is the moment it opens', async () => {
        await doc.open('Alpha/Alpha.md');

        // Seeded from the file's mtime, not left null waiting for this session to
        // write. Otherwise the status bar has nothing to say about a document the
        // Files screen was captioning "Edited 3 days ago" one click earlier.
        expect(doc.savedAt).toBeGreaterThan(0);
        expect(doc.saveState).toBe('idle');
    });

    it('drops a pending autosave when another document is opened', async () => {
        await doc.open('Alpha/Alpha.md');
        doc.applyEdit(content('Alpha edited'));

        // No time passes: the debounce is still pending when the user leaves.
        await doc.open('Bravo/Bravo.md');
        await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 2);

        expect(documentWrites()).toHaveLength(0);
        expect(await readFile('Alpha', 'Alpha.md')).toContain('Alpha body');
    });

    it('never carries one document’s frontmatter into the next', async () => {
        await doc.open('Alpha/Alpha.md');
        await doc.open('Bravo/Bravo.md');

        doc.applyEdit(content('Bravo edited'));
        await doc.flush();

        const bravo = await readFile('Bravo', 'Bravo.md');
        expect(bravo).toBe('Bravo edited');
        expect(bravo).not.toContain('title: Alpha');
    });

    it('writes a document back with its own frontmatter intact', async () => {
        await doc.open('Alpha/Alpha.md');

        doc.applyEdit(content('Alpha edited'));
        await doc.flush();

        const alpha = await readFile('Alpha', 'Alpha.md');
        expect(alpha).toContain('title: Alpha');
        expect(alpha).toContain('Alpha edited');
    });

    it('writes into the document that is open, not the one before it', async () => {
        await doc.open('Alpha/Alpha.md');
        await doc.open('Bravo/Bravo.md');

        doc.applyEdit(content('Bravo edited'));
        await doc.flush();

        expect(await readFile('Alpha', 'Alpha.md')).toContain('Alpha body');
    });
});

describe('close', () => {
    it('flushes the last edit and then clears the document', async () => {
        await opfs.writeRaw(root, 'Charlie', 'Charlie.md', 'Charlie body');
        await doc.open('Charlie/Charlie.md');
        doc.applyEdit(content('Charlie edited'));

        await doc.close();

        expect(await readFile('Charlie', 'Charlie.md')).toBe('Charlie edited');
        expect(doc.location).toBeNull();
        expect(doc.title).toBe('');
        expect(doc.contentJson).toBeNull();
        expect(doc.isDirty).toBe(false);
    });
});
