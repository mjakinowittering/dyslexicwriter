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

// Long enough that a writer mid-paragraph is not interrupted by a write on every
// pause for thought, short enough that the gap between the last keystroke and the
// disk stays small. Measured from the LAST edit, so it restarts on every keystroke.
export const AUTOSAVE_DEBOUNCE_MS = 30_000;

// …which is why the debounce cannot be the only timer. A deadline that every
// keystroke pushes further away is never reached while the typing is unbroken: a
// writer in flow could go an hour without one byte reaching the disk, and would
// have no way of knowing. This is the ceiling on that, measured from the FIRST
// unsaved edit and never extended, so a run of continuous writing still gets
// written. Only a pause shorter than the debounce can be paid for with it.
export const AUTOSAVE_MAX_WAIT_MS = 60_000;

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
    #dirty = false;
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

        try {
            const doc = await readDocument(root, path);
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
        if (!root || !content) return;

        // Claim the work before awaiting, so a second flush queues behind this
        // one instead of racing it.
        this.#dirty = false;
        this.saveState = 'saving';

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

                this.location = location;
                this.saveState = 'saved';
                this.savedAt = Date.now();
                this.error = '';

                // A new folder has appeared on disk, so the tree has to be
                // rescanned; an existing document only needs its mtime moved on.
                if (firstSave) await workspace.refresh();
                else await workspace.touch(entry);
            } catch {
                // Put the document back in the dirty state: the next flush (or
                // the user's next keystroke) will retry rather than drop the edit.
                this.#dirty = true;
                this.saveState = 'error';
                this.error = m.editor_save_error();
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

        // Pending edits must land under the OLD name before anything moves.
        await this.flush();

        const location = this.location;
        if (!root || location === null) return;

        try {
            const entry = await renameDocument(root, location, target);
            this.title = entry.title;
            this.location = {
                folder: entry.folder,
                file: entry.file,
                ownsFolder: entry.ownsFolder
            };
            this.error = '';
            await workspace.refresh();
        } catch (cause) {
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

        if (this.location === null) {
            this.#dirty = true;
            await this.flush();
        }
        if (this.location === null) return null;

        try {
            return await writeImage(root, this.location.folder, file);
        } catch {
            this.error = m.editor_image_error();
            return null;
        }
    }

    #reset(): void {
        this.#clearTimers();
        this.#dirty = false;
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
    async close(): Promise<void> {
        await this.flush();
        this.#reset();
    }
}

export const doc = new DocumentStore();
