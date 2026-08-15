import type { JSONContent } from '@tiptap/core';

import {
    DocumentError,
    readDocument,
    renameDocument,
    suggestUntitledName,
    writeDocument,
    writeImage
} from '$lib/fs';
import { sanitiseTitle } from '$lib/models/document.model';
import * as m from '$lib/paraglide/messages';

import { workspace } from './workspace.svelte';

// The open document, and everything that writes it to disk.
//
// This app holds the only copy of the user's work while a document is open, so
// the failure mode that matters most is a lost edit. Autosave debounces typing,
// but every exit path (blur, tab hidden, page unload, navigation) FLUSHES: the
// debounce is an optimisation, never the thing standing between a keystroke and
// the disk.

const AUTOSAVE_DEBOUNCE_MS = 600;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

class DocumentStore {
    title = $state('');
    contentJson = $state<JSONContent | null>(null);
    wordCount = $state(0);
    formatting = $state<string[]>([]);

    // The folder this document lives in, or null while it is still unsaved and
    // in-memory only ("Untitled" before the first write).
    folder = $state<string | null>(null);
    saveState = $state<SaveState>('idle');
    error = $state('');

    #timer: ReturnType<typeof setTimeout> | null = null;
    #dirty = false;
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

    async open(folder: string): Promise<void> {
        const root = workspace.root;
        if (!root) return;

        this.#reset();

        try {
            const doc = await readDocument(root, folder);
            this.title = doc.title;
            this.folder = doc.folder;
            this.contentJson = doc.contentJson;
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
        this.saveState = 'idle';
        this.#schedule();
    }

    #schedule(): void {
        if (this.#timer) clearTimeout(this.#timer);
        this.#timer = setTimeout(() => void this.flush(), AUTOSAVE_DEBOUNCE_MS);
    }

    // Write now. Safe to call at any time and from any exit path; a no-op when
    // there is nothing pending.
    async flush(): Promise<void> {
        if (this.#timer) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }
        if (!this.#dirty) return;

        const root = workspace.root;
        const content = this.contentJson;
        if (!root || !content) return;

        // Claim the work before awaiting, so a second flush queues behind this
        // one instead of racing it.
        this.#dirty = false;
        this.saveState = 'saving';

        this.#writing = this.#writing.then(async () => {
            try {
                const folder = this.folder ?? sanitiseTitle(this.title);
                const entry = await writeDocument(root, folder, content);

                this.folder = entry.folder;
                this.saveState = 'saved';
                this.error = '';
                await workspace.refresh();
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
        if (!this.folder) {
            this.title = target;
            return;
        }

        // Pending edits must land under the OLD name before the folder moves.
        await this.flush();

        if (!root) return;

        try {
            const entry = await renameDocument(root, this.folder, target);
            this.title = entry.title;
            this.folder = entry.folder;
            this.error = '';
            await workspace.refresh();
        } catch (cause) {
            this.error =
                cause instanceof DocumentError
                    ? cause.message
                    : m.editor_rename_error();
        }
    }

    // Write a dropped image into this document's own folder and return the
    // relative path to reference it by. Forces a save first when the document is
    // still in memory, so the image has a folder to land in.
    async addImage(file: File): Promise<string | null> {
        const root = workspace.root;
        if (!root) return null;

        if (!this.folder) {
            this.#dirty = true;
            await this.flush();
        }
        if (!this.folder) return null;

        try {
            return await writeImage(root, this.folder, file);
        } catch {
            this.error = m.editor_image_error();
            return null;
        }
    }

    #reset(): void {
        if (this.#timer) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }
        this.#dirty = false;
        this.title = '';
        this.contentJson = null;
        this.folder = null;
        this.wordCount = 0;
        this.formatting = [];
        this.saveState = 'idle';
        this.error = '';
    }

    // Flush and clear, for when the editor unmounts.
    async close(): Promise<void> {
        await this.flush();
        this.#reset();
    }
}

export const doc = new DocumentStore();
