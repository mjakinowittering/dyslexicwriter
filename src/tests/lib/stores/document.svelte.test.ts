import * as opfs from '../../support/opfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fromMarkdown } from '$lib/markdown';
import {
    AUTOSAVE_DEBOUNCE_MS,
    AUTOSAVE_MAX_WAIT_MS,
    AUTOSAVE_RETRY_BASE_MS,
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

    // Both timers the store arms are started by a keystroke, so a writer who hits
    // a failure and then stops typing has nothing scheduled at all. The retry is
    // what stops the disk copy waiting on `pagehide` — the point at which there is
    // no second chance left.
    it('retries on its own, with no further keystroke or flush', async () => {
        await doc.createNew();
        await blockTheLocation();

        doc.applyEdit(content('Precious'));
        await doc.flush();
        expect(doc.isRetrying).toBe(true);

        // Whatever went wrong is over — the drive is back, the folder is there.
        await root.removeEntry('Blocked');

        // Nothing here touches the document: no edit, no explicit flush, no exit
        // path. The retry alone has to carry it.
        await vi.advanceTimersByTimeAsync(AUTOSAVE_RETRY_BASE_MS);
        await vi.waitFor(() => expect(doc.saveState).toBe('saved'));

        expect(doc.isDirty).toBe(false);
        expect(doc.error).toBe('');
        expect(await readFile('Blocked', 'Blocked.md')).toBe('Precious');
    });

    it('backs off between attempts rather than spinning', async () => {
        await doc.createNew();
        await blockTheLocation();

        doc.applyEdit(content('Precious'));
        await doc.flush();
        ignoreFixtureWrites();

        // The first retry is the base interval away, and not a millisecond sooner.
        await vi.advanceTimersByTimeAsync(AUTOSAVE_RETRY_BASE_MS - 1);
        expect(documentWrites()).toHaveLength(0);

        await vi.advanceTimersByTimeAsync(1);
        await vi.waitFor(() => expect(doc.isRetrying).toBe(true));

        // …and having failed again, the second waits twice as long, so a folder
        // that stays gone is asked about less and less often.
        await vi.advanceTimersByTimeAsync(AUTOSAVE_RETRY_BASE_MS);
        expect(doc.saveState).toBe('error');

        await root.removeEntry('Blocked');
        await vi.advanceTimersByTimeAsync(AUTOSAVE_RETRY_BASE_MS);
        await vi.waitFor(() => expect(doc.saveState).toBe('saved'));
    });

    // The other way the write path used to go quiet: `flush()` clears both timers
    // on the way in, and the working folder having gone is an early return AFTER
    // that — a dirty document, no timer, and a status bar still saying 'pending'
    // with nothing whatsoever coming.
    it('arms a retry when there is nowhere to write to at all', async () => {
        await doc.createNew();
        doc.applyEdit(content('Nowhere to go'));

        workspace.root = null;
        await doc.flush();

        expect(documentWrites()).toHaveLength(0);
        expect(doc.isDirty).toBe(true);
        expect(doc.saveState).toBe('pending');
        expect(doc.isRetrying).toBe(true);

        workspace.root = root;
        await vi.advanceTimersByTimeAsync(AUTOSAVE_RETRY_BASE_MS);
        await vi.waitFor(() => expect(doc.saveState).toBe('saved'));

        expect(await readFile('Untitled', 'Untitled.md')).toBe('Nowhere to go');
    });
});

// A write, a read and a rename all await, and the document can be closed or
// swapped while one is in flight. What must never happen is the old document's
// facts landing on the new one — an editor left empty, or pointed at the previous
// document's file.
//
// `createWritable` is gated rather than mocked away: the write genuinely happens,
// just not until the test says so, which is the only way to hold one open across
// an `open()`.
describe('a write still in flight when the document changes', () => {
    let release: (() => void) | null;

    beforeEach(async () => {
        release = null;

        await opfs.writeRaw(root, 'Alpha', 'Alpha.md', 'Alpha body');
        await opfs.writeRaw(root, 'Bravo', 'Bravo.md', 'Bravo body');
        ignoreFixtureWrites();

        vi.spyOn(
            FileSystemFileHandle.prototype,
            'createWritable'
        ).mockImplementation(function (
            this: FileSystemFileHandle,
            options?: FileSystemCreateWritableOptions
        ) {
            opened.push(this.name);
            return new Promise((resolve) => {
                // Clears itself on the way through, so the safety net below
                // cannot open a SECOND writable on a gate already let go. An
                // unclosed stream holds an OPFS lock, and the next test's
                // `emptyRoot()` then cannot delete the file it is holding.
                release = () => {
                    release = null;
                    resolve(nativeCreateWritable.call(this, options));
                };
            });
        });
    });

    afterEach(() => {
        // Never leave a writable pending: the store's own promise chain would
        // still be waiting on it when the next test starts.
        release?.();
    });

    it('does not let a late close() wipe the document opened after it', async () => {
        await doc.open('Alpha/Alpha.md');
        doc.applyEdit(content('Alpha edited'));

        // Exactly what the editor does on unmount: fired, never awaited.
        const closing = doc.close();
        await vi.waitFor(() => expect(release).not.toBeNull());

        // The next document opens while Alpha's write is still going.
        await doc.open('Bravo/Bravo.md');

        release?.();
        await closing;

        // `close()` reset the store it no longer owns before this guard existed,
        // leaving the editor blank on a document that had just loaded.
        expect(doc.title).toBe('Bravo');
        expect(doc.location).toEqual({
            folder: 'Bravo',
            file: 'Bravo.md',
            ownsFolder: true
        });
        expect(doc.contentJson).not.toBeNull();
    });

    it('does not report the previous document’s save against the new one', async () => {
        await doc.open('Alpha/Alpha.md');
        doc.applyEdit(content('Alpha edited'));

        const flushing = doc.flush();
        await vi.waitFor(() => expect(release).not.toBeNull());

        await doc.open('Bravo/Bravo.md');
        const openedAt = doc.savedAt;

        release?.();
        await flushing;

        // Alpha's write finished and is on disk — but it is Alpha's write, and
        // saying 'saved' here would have the status bar reporting it against
        // Bravo, whose location it would also have overwritten.
        expect(doc.location?.folder).toBe('Bravo');
        expect(doc.saveState).toBe('idle');
        expect(doc.savedAt).toBe(openedAt);
        expect(await readFile('Alpha', 'Alpha.md')).toBe('Alpha edited');
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

// Renaming the open document.
//
// The title field fires this on change/blur, and by then there may be edits the
// disk has not seen. The ordering is the whole point: pending edits land under
// the OLD name before anything moves, because a rename that runs first leaves
// that edit belonging to a file which no longer exists. Everything else here is
// about not destroying the source when the move cannot be completed.
describe('rename', () => {
    it('relabels an unsaved document without writing anything', async () => {
        await doc.createNew();
        ignoreFixtureWrites();

        await doc.rename('Chapter One');

        // Renaming is just relabelling until the first save — there is nothing
        // on disk to move, and creating something here would be a write the
        // writer never asked for.
        expect(doc.title).toBe('Chapter One');
        expect(doc.location).toBeNull();
        expect(documentWrites()).toHaveLength(0);
    });

    it('moves the folder and the file, leaving nothing behind', async () => {
        await doc.createNew();
        doc.applyEdit(content('Body'));
        await doc.flush();

        await doc.rename('Chapter One');

        expect(doc.title).toBe('Chapter One');
        expect(doc.location).toEqual({
            folder: 'Chapter One',
            file: 'Chapter One.md',
            ownsFolder: true
        });
        expect(await readFile('Chapter One', 'Chapter One.md')).toBe('Body');
        // The old folder is gone: a rename that leaves a copy behind shows the
        // writer two documents where they have one.
        await expect(
            opfs.fileExists(root, 'Untitled', 'Untitled.md')
        ).resolves.toBe(false);
    });

    // A saved document with a later edit still sitting in the debounce window.
    // Renaming without flushing first would move the file as it was and drop
    // that edit on the floor — the one failure this app exists to avoid.
    it('lands a pending edit under the old name before moving it', async () => {
        await doc.createNew();
        doc.applyEdit(content('First'));
        await doc.flush();

        doc.applyEdit(content('Written just before the rename'));
        expect(doc.isDirty).toBe(true);

        await doc.rename('Chapter One');

        expect(await readFile('Chapter One', 'Chapter One.md')).toBe(
            'Written just before the rename'
        );
        expect(doc.isDirty).toBe(false);
    });

    // There is no trash behind any of this, so a refused rename has to leave the
    // document exactly where it was rather than half-moved.
    it('keeps the source intact when the name is already taken', async () => {
        await opfs.writeRaw(root, 'Taken', 'Taken.md', 'Somebody else');
        await doc.createNew();
        doc.applyEdit(content('Mine'));
        await doc.flush();

        await doc.rename('Taken');

        expect(doc.error).not.toBe('');
        expect(doc.title).toBe('Untitled');
        expect(doc.location?.folder).toBe('Untitled');
        expect(await readFile('Untitled', 'Untitled.md')).toBe('Mine');
        // And the document that was already there is untouched.
        expect(await readFile('Taken', 'Taken.md')).toBe('Somebody else');
    });

    it('ignores a title that sanitises away to nothing', async () => {
        await doc.createNew();
        doc.applyEdit(content('Body'));
        await doc.flush();
        ignoreFixtureWrites();

        await doc.rename('///');

        expect(doc.title).toBe('Untitled');
        expect(documentWrites()).toHaveLength(0);
    });

    it('does nothing when the title has not actually changed', async () => {
        await doc.createNew();
        doc.applyEdit(content('Body'));
        await doc.flush();
        ignoreFixtureWrites();

        await doc.rename('Untitled');

        expect(documentWrites()).toHaveLength(0);
        expect(doc.location?.folder).toBe('Untitled');
    });

    // Nothing in a rename is synchronous, so the document can be swapped while
    // one is in flight. Whatever it goes on to work out belongs to a document
    // nobody has open any more: assigning the title or location it produced
    // would leave the editor showing one document and pointed at another's file.
    it('does not write a rename back onto the document that replaced it', async () => {
        await doc.createNew();
        doc.applyEdit(content('First'));
        await doc.flush();

        const renaming = doc.rename('Chapter One');
        await doc.createNew();
        await renaming;

        expect(doc.title).not.toBe('Chapter One');
        expect(doc.location?.folder).not.toBe('Chapter One');
    });
});

// Writing a dropped or pasted image into the document's own directory.
//
// A document folder has to stay self-contained and portable as a unit, so the
// image goes beside the markdown that references it and comes back as a relative
// path — never base64, never a shared top-level images folder.
describe('addImage', () => {
    const png = (): File =>
        new File([new Uint8Array([137, 80, 78, 71])], 'diagram.png', {
            type: 'image/png'
        });

    it('writes the image into the document folder and returns a relative path', async () => {
        await doc.createNew();
        doc.applyEdit(content('Body'));
        await doc.flush();

        const path = await doc.addImage(png());

        expect(path).toBe('diagram.png');
        await expect(
            opfs.fileExists(root, 'Untitled', 'diagram.png')
        ).resolves.toBe(true);
    });

    // An in-memory document has no folder yet, so there is nowhere for the image
    // to land — the save is forced to make one rather than dropping the image.
    it('forces the first save so the image has somewhere to go', async () => {
        await doc.createNew();
        expect(doc.location).toBeNull();

        const path = await doc.addImage(png());

        expect(path).toBe('diagram.png');
        expect(doc.location?.folder).toBe('Untitled');
        await expect(
            opfs.fileExists(root, 'Untitled', 'diagram.png')
        ).resolves.toBe(true);
    });

    it('says so rather than returning a path to nothing', async () => {
        await doc.createNew();
        doc.applyEdit(content('Body'));
        await doc.flush();

        vi.spyOn(
            FileSystemDirectoryHandle.prototype,
            'getFileHandle'
        ).mockRejectedValue(new DOMException('no', 'NotAllowedError'));

        const path = await doc.addImage(png());

        expect(path).toBeNull();
        expect(doc.error).not.toBe('');
    });

    it('writes nothing when there is no working folder', async () => {
        await doc.createNew();
        workspace.root = null;

        await expect(doc.addImage(png())).resolves.toBeNull();

        workspace.root = root;
    });
});
