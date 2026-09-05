import type { JSONContent } from '@tiptap/core';

import {
    DocumentError,
    readDocument,
    renameDocument,
    suggestUntitledName,
    writeDocument,
    writeImage,
    type DocumentLocation
} from '$lib/fs';
import type { Frontmatter } from '$lib/markdown';
import { fileNameFor, sanitiseTitle } from '$lib/models/document.model';
import * as m from '$lib/paraglide/messages';

import { workspace } from './workspace.svelte';

// The open document, and everything that writes it to disk.
//
// This app holds the only copy of the user's work while a document is open, so
// the failure mode that matters most is a lost edit. Autosave debounces typing,
// but every exit path (blur, tab hidden, page unload, navigation) FLUSHES: the
// debounce is an optimisation, never the thing standing between a keystroke and
// the disk.
//
// Note what this store is NOT told about. `applyEdit` is the only thing that
// marks the document dirty, and `flush` is a no-op on a clean one — so an edit
// that never reaches `applyEdit` is invisible to every exit path at once. The
// editor does not rely on being handed each change as it happens: it compares
// its own content against what it last reported (see PageEditor's CONTENT_CHECK_MS)
// and calls in anything that arrived by some other route — a browser extension
// rewriting the DOM, say.

// Long enough that a writer mid-word is not interrupted by a write between one
// keystroke and the next, short enough that "unsaved" is a state a writer passes
// through rather than the one they sit in all session. Measured from the LAST
// edit, so it restarts on every keystroke.
export const AUTOSAVE_DEBOUNCE_MS = 5_000;

// …which is why the debounce cannot be the only timer. A deadline that every
// keystroke pushes further away is never reached while the typing is unbroken: a
// writer in flow could go an hour without one byte reaching the disk, and would
// have no way of knowing. This is the ceiling on that, measured from the FIRST
// unsaved edit and never extended, so a run of continuous writing still gets
// written. Only a pause shorter than the debounce can be paid for with it.
export const AUTOSAVE_MAX_WAIT_MS = 30_000;

// A write that failed is not a write that can be forgotten. Both timers above are
// armed by a keystroke, so a writer who hits a transient failure — an unplugged
// drive, a folder renamed underneath them — and then stops typing has nothing left
// scheduled and is relying on `pagehide` alone. These arm the retry instead: the
// first five seconds later, then doubling, then every minute for as long as it
// takes. Deliberately without a give-up: giving up is the failure this exists to
// prevent, and a minute apart it costs nothing to keep asking.
export const AUTOSAVE_RETRY_BASE_MS = 5_000;
export const AUTOSAVE_RETRY_MAX_MS = 60_000;

// `idle` is the opening state and means nothing has happened yet — distinct from
// `pending`, which means there are edits the disk has not seen. The status bar
// has to tell those apart, and `#dirty` is a plain field the UI cannot observe.
export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

// Where a brand-new document goes on its first save: a folder of its own at the
// top level of the working folder, holding a markdown file of the same name. The
// app only ever creates this shape — nested and loose documents are ones it found.
function newLocation(title: string): DocumentLocation {
    const name = sanitiseTitle(title);
    return { folder: name, file: fileNameFor(name), ownsFolder: true };
}

class DocumentStore {
    title = $state('');
    contentJson = $state<JSONContent | null>(null);
    wordCount = $state(0);
    formatting = $state<string[]>([]);

    // Where this document lives, or null while it is still unsaved and in-memory
    // only ("Untitled" before the first write).
    //
    // Note the null: '' is a real folder — the working folder itself, where a
    // loose `notes.md` sits — so "not saved yet" has to be tested against null and
    // never against falsiness.
    location = $state<DocumentLocation | null>(null);
    saveState = $state<SaveState>('idle');
    // When the last successful write landed, as a Unix-ms timestamp, or null when
    // nothing has been written since this document was opened. The status bar
    // reports it as an age, so with edits pending the writer can still see how
    // long ago the copy on disk was made current.
    savedAt = $state<number | null>(null);
    error = $state('');

    #timer: ReturnType<typeof setTimeout> | null = null;
    // Set once per run of unsaved edits and never pushed back — see
    // AUTOSAVE_MAX_WAIT_MS. Cleared together with #timer whenever the document
    // goes clean, so a save that has already happened cannot fire a second one.
    #ceiling: ReturnType<typeof setTimeout> | null = null;
    // The backoff after a failed write, and how many attempts it has made — see
    // AUTOSAVE_RETRY_BASE_MS. The count is per run of failures, not per document:
    // one write landing puts it back to zero.
    #retry: ReturnType<typeof setTimeout> | null = null;
    #retries = 0;
    #dirty = false;
    // Which document the store is holding, bumped by every `#reset()`.
    //
    // Nothing here is synchronous: a write, a read and a rename all await, and the
    // document can be closed or swapped while one is in flight. A continuation that
    // then assigns `location`, `title` or `saveState` is writing the OLD document's
    // facts over the NEW one's — an editor left empty, or worse, pointed at the
    // previous document's file. So every method captures this before its first
    // await and gives up quietly if it has moved on: the work it was doing belongs
    // to a document nobody is looking at any more.
    #epoch = 0;
    // The open file's YAML frontmatter, held only so the next write can put it
    // back exactly as it was. Deliberately not $state: nothing in the UI reads it,
    // and a state proxy has no business being handed to a YAML serialiser.
    #frontmatter: Frontmatter | null = null;
    // Serialises writes so a flush can never overlap an in-flight autosave and
    // land the two out of order.
    #writing: Promise<void> = Promise.resolve();

    get isDirty(): boolean {
        return this.#dirty;
    }

    // Is a failed write waiting to try again? The suite asserts on this: "left
    // dirty" and "left dirty with something coming" are very different states, and
    // the difference is the whole of what a retry is.
    get isRetrying(): boolean {
        return this.#retry !== null;
    }

    // Start a new document in memory. Nothing touches the disk until the first
    // save, so abandoning it leaves no empty folder behind.
    async createNew(): Promise<void> {
        const root = workspace.root;
        this.#reset();
        this.title = root ? await suggestUntitledName(root) : 'Untitled';
        this.contentJson = { type: 'doc', content: [{ type: 'paragraph' }] };
    }

    // `path` is the markdown file's path relative to the working folder —
    // `notes.md`, `Chapters/One.md` — or, for a link made before the Files screen
    // showed a tree, a bare document folder name.
    async open(path: string): Promise<void> {
        const root = workspace.root;
        if (!root) return;

        this.#reset();
        const epoch = this.#epoch;

        try {
            const doc = await readDocument(root, path);
            // Two opens can overlap — the editor's `?doc=` changing twice in quick
            // succession — and the slower read must not land on top of the faster
            // one. Whoever reset last owns the store.
            if (epoch !== this.#epoch) return;

            this.title = doc.title;
            this.location = {
                folder: doc.folder,
                file: doc.file,
                ownsFolder: doc.ownsFolder
            };
            this.contentJson = doc.contentJson;
            this.#frontmatter = doc.frontmatter;
            // Seeded from the file's mtime rather than left null until this
            // session happens to write: a document opened from disk was saved at
            // a real moment, and the writer should be told when — the same
            // "Edited 3 days ago" the Files screen showed a click earlier.
            this.savedAt = doc.lastModified;
        } catch (cause) {
            if (epoch !== this.#epoch) return;

            this.error =
                cause instanceof DocumentError
                    ? cause.message
                    : m.editor_open_error();
        }
    }

    // Called on every editor transaction that changes the document.
    applyEdit(contentJson: JSONContent): void {
        this.contentJson = contentJson;
        this.#dirty = true;
        this.saveState = 'pending';
        this.#schedule();
    }

    #schedule(): void {
        if (this.#timer) clearTimeout(this.#timer);
        this.#timer = setTimeout(() => void this.flush(), AUTOSAVE_DEBOUNCE_MS);

        // `??=` short-circuits, so this arms on the first edit of a dirty run and
        // every later keystroke leaves it exactly where it is.
        this.#ceiling ??= setTimeout(
            () => void this.flush(),
            AUTOSAVE_MAX_WAIT_MS
        );
    }

    #clearTimers(): void {
        if (this.#timer) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }
        if (this.#ceiling) {
            clearTimeout(this.#ceiling);
            this.#ceiling = null;
        }
        if (this.#retry) {
            clearTimeout(this.#retry);
            this.#retry = null;
        }
    }

    // Try again, later. Exponential from the base up to the ceiling and then flat,
    // so a folder that comes back after five minutes is written to within a minute
    // of returning, and one that never comes back costs a call a minute.
    //
    // The attempt count is read before it is incremented, so the first retry waits
    // the base interval rather than double it.
    #scheduleRetry(): void {
        if (this.#retry) clearTimeout(this.#retry);

        const delay = Math.min(
            AUTOSAVE_RETRY_BASE_MS * 2 ** this.#retries,
            AUTOSAVE_RETRY_MAX_MS
        );
        this.#retries += 1;
        this.#retry = setTimeout(() => void this.flush(), delay);
    }

    // Write now. Safe to call at any time and from any exit path; a no-op when
    // there is nothing pending.
    async flush(): Promise<void> {
        this.#clearTimers();

        // Not dirty does not mean nothing is in flight: the debounce or the
        // max-wait ceiling may already have claimed this edit and be part-way
        // through writing it. Returning here would tell `pagehide` the document
        // is on disk while the writable is still open — the dropped last edit
        // this whole lifecycle exists to prevent.
        if (!this.#dirty) {
            await this.#writing;
            return;
        }

        const root = workspace.root;
        const content = this.contentJson;
        // Nowhere to write to — the working folder has gone, or gone unreadable.
        // The timers were cleared on the way in, so returning here would leave a
        // dirty document with nothing scheduled to save it: the same quiet
        // give-up as a failed write, and treated the same way.
        if (!root || !content) {
            this.saveState = 'pending';
            this.#scheduleRetry();
            return;
        }

        // Claim the work before awaiting, so a second flush queues behind this
        // one instead of racing it.
        this.#dirty = false;
        this.saveState = 'saving';
        const epoch = this.#epoch;

        // A first save creates the folder-document shape the app owns: a folder at
        // the top level named for the title, holding a markdown file of the same
        // name. Documents found elsewhere on disk keep the location they were
        // opened from.
        const firstSave = this.location === null;
        const location = this.location ?? newLocation(this.title);
        const frontmatter = this.#frontmatter;

        this.#writing = this.#writing.then(async () => {
            try {
                const entry = await writeDocument(
                    root,
                    location,
                    content,
                    frontmatter
                );

                // The file is on disk either way, so the tree is caught up
                // below regardless — but the store now belongs to a different
                // document, and this one's location and save time are no longer
                // anything it should be reporting.
                if (epoch === this.#epoch) {
                    this.location = location;
                    this.saveState = 'saved';
                    this.savedAt = Date.now();
                    this.error = '';
                    this.#retries = 0;
                }

                // A new folder has appeared on disk, so the tree has to be
                // rescanned; an existing document only needs its mtime moved on.
                if (firstSave) await workspace.refresh();
                else await workspace.touch(entry);
            } catch {
                // A failure belonging to a document that has since been closed or
                // swapped has nowhere to go: marking dirty here would arm a retry
                // that writes the CURRENT document's content into the old one's
                // file. The edit is already gone with the reset that replaced it.
                if (epoch !== this.#epoch) return;

                // Put the document back in the dirty state and arm the retry, so
                // a writer who stops typing after a failure still gets the edit on
                // to disk once whatever went wrong is over.
                this.#dirty = true;
                this.saveState = 'error';
                this.error = m.editor_save_error();
                this.#scheduleRetry();
            }
        });

        await this.#writing;
    }

    // Renaming is triggered on the title field's change/blur, never per keystroke:
    // one rename per edit session, not one per character typed.
    async rename(nextTitle: string): Promise<void> {
        const root = workspace.root;
        const target = sanitiseTitle(nextTitle);

        if (target.length === 0 || target === this.title) return;

        // Still in memory — renaming is just relabelling until the first save.
        if (this.location === null) {
            this.title = target;
            return;
        }

        const epoch = this.#epoch;

        // Pending edits must land under the OLD name before anything moves.
        await this.flush();
        if (epoch !== this.#epoch) return;

        const location = this.location;
        if (!root || location === null) return;

        try {
            const entry = await renameDocument(root, location, target);
            // The document was closed or swapped while the rename was running.
            // The file on disk has its new name — that part stands — but this
            // title and location describe a document nobody has open.
            if (epoch !== this.#epoch) return;

            this.title = entry.title;
            this.location = {
                folder: entry.folder,
                file: entry.file,
                ownsFolder: entry.ownsFolder
            };
            this.error = '';
            await workspace.refresh();
        } catch (cause) {
            if (epoch !== this.#epoch) return;

            this.error =
                cause instanceof DocumentError
                    ? cause.message
                    : m.editor_rename_error();
        }
    }

    // Write a dropped image into this document's own directory and return the
    // relative path to reference it by. Forces a save first when the document is
    // still in memory, so the image has somewhere to land.
    async addImage(file: File): Promise<string | null> {
        const root = workspace.root;
        if (!root) return null;

        const epoch = this.#epoch;

        if (this.location === null) {
            this.#dirty = true;
            await this.flush();
        }
        // The forced save may have taken long enough for the document to be
        // closed or swapped. Writing the image now would put it in whichever
        // folder is open instead, and hand back a path the editor resolves
        // against a different document.
        if (epoch !== this.#epoch) return null;
        if (this.location === null) return null;

        try {
            return await writeImage(root, this.location.folder, file);
        } catch {
            if (epoch !== this.#epoch) return null;

            this.error = m.editor_image_error();
            return null;
        }
    }

    #reset(): void {
        this.#clearTimers();
        this.#dirty = false;
        this.#retries = 0;
        // Everything in flight against the document being cleared is now working
        // for nobody, and this is what tells it so.
        this.#epoch += 1;
        this.title = '';
        this.contentJson = null;
        // Miss the location and opening document B would write it into document
        // A's file; miss the frontmatter and A's metadata lands in B's.
        this.location = null;
        this.#frontmatter = null;
        this.wordCount = 0;
        this.formatting = [];
        this.saveState = 'idle';
        this.savedAt = null;
        this.error = '';
    }

    // Flush and clear, for when the editor unmounts.
    //
    // The editor fires this un-awaited from `onDestroy`, so the flush can still be
    // running when the next document opens — and the reset below would then wipe
    // the document that has just been loaded, leaving an empty editor. If anything
    // has claimed the store while we were writing, the clearing is already done
    // and is not ours to repeat.
    async close(): Promise<void> {
        const epoch = this.#epoch;
        await this.flush();
        if (epoch !== this.#epoch) return;

        this.#reset();
    }
}

export const doc = new DocumentStore();
