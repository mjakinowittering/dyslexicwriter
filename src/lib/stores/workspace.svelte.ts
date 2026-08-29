import { setMode } from 'mode-watcher';
import { SvelteSet } from 'svelte/reactivity';

import {
    clearDirectoryHandle,
    ensurePermission,
    ensureSubfolder,
    findDocument,
    flattenDocuments,
    folderIsReachable,
    loadDirectoryHandle,
    readConfig,
    saveDirectoryHandle,
    scanFolder,
    updateConfig,
    type FolderNode
} from '$lib/fs';
import {
    defaultConfig,
    type Config,
    type DocumentIndexEntry,
    type Font,
    type Theme
} from '$lib/models/config.model';
import * as m from '$lib/paraglide/messages';

// The user's chosen working folder, the settings read from it, and the document
// index shown on the Files screen.
//
// Everything here is derived from two things on the user's machine: the directory
// handle (in IndexedDB) and config.json (in the folder itself). Nothing is cached
// anywhere else.

export type WorkspaceStatus =
    | 'loading' // checking IndexedDB for a previously chosen folder
    | 'unsupported' // browser has no File System Access API
    | 'needs-folder' // first run, or the stored folder was given up on
    | 'needs-permission' // a stored folder we may not touch until the user says so
    | 'ready';

// The slice of the workspace the settings panel touches: the two preferences it
// shows, and the two writers behind them. Narrow on purpose — a story or a test can
// satisfy this without a directory handle, and every setter here would otherwise
// try to write config.json to a folder that isn't there.
export interface PreferenceStore {
    readonly theme: Theme;
    readonly font: Font;
    setTheme(theme: Theme): Promise<void>;
    setFont(font: Font): Promise<void>;
}

class WorkspaceStore implements PreferenceStore {
    status = $state<WorkspaceStatus>('loading');
    root = $state<FileSystemDirectoryHandle | null>(null);
    // The stored folder we found but may not read yet. Held only for the length
    // of the 'needs-permission' state, so the welcome screen can name it and
    // `reopen()` has something to ask about.
    pending = $state<FileSystemDirectoryHandle | null>(null);
    config = $state<Config>(defaultConfig());
    // The working folder as a tree of directories and the documents inside them.
    tree = $state<FolderNode | null>(null);
    // Folders the user has collapsed. Everything the scan reached starts open, so
    // this tracks the exception rather than the rule. Deliberately in memory only:
    // every persisted preference belongs in config.json, and which folders happen
    // to be open is not a preference worth writing to the user's disk.
    collapsed = new SvelteSet<string>();
    error = $state('');

    // Folders the depth cap stopped at that the user has since expanded. Replayed
    // after each refresh so a rescan doesn't fold the tree back up.
    #opened = new Set<string>();

    // Flat view of the tree, for the config.json index and the empty state.
    documents: DocumentIndexEntry[] = $derived(
        this.tree ? flattenDocuments(this.tree) : []
    );

    // The stored folder's name, for the "Reopen …" card. A handle carries its
    // name whether or not we have permission to open it, so there is nothing to
    // remember separately — IndexedDB still holds exactly one thing.
    get pendingName(): string {
        return this.pending?.name ?? '';
    }

    get theme(): Theme {
        return this.config.theme;
    }

    get font(): Font {
        return this.config.font;
    }

    // Try to pick up where the user left off. A stored handle usually still has
    // its permission granted, in which case this is silent; if not we hold it
    // aside and let the welcome screen offer to reopen it, rather than prompting
    // outside a user gesture (Chromium rejects requestPermission without one) or
    // pretending this is a first run.
    async restore(): Promise<void> {
        const handle = await loadDirectoryHandle();
        if (!handle) {
            this.status = 'needs-folder';
            return;
        }

        if (!(await ensurePermission(handle))) {
            this.pending = handle;
            this.status = 'needs-permission';
            return;
        }

        await this.#adopt(handle);
    }

    // Ask for the stored folder back. The card that calls this is the user
    // gesture requestPermission needs; Chromium's "allow on every visit" grant
    // then makes `restore()` silent from the next visit on.
    async reopen(): Promise<void> {
        const handle = this.pending;
        if (!handle) return;

        // Whatever went wrong last time is about to be answered one way or the
        // other; leaving it up would have the screen explaining a refusal the
        // user is in the middle of retrying.
        this.error = '';

        if (!(await ensurePermission(handle, { prompt: true }))) {
            this.error = m.welcome_permission_denied();
            return;
        }

        // Permission can be granted for a folder that is no longer there, and
        // every read below this swallows its own errors, so ask the folder
        // directly before committing to it. Nothing is recoverable from a handle
        // that can't resolve: let it go and send the user back to the picker
        // rather than leaving them on a card that will never work.
        if (!(await folderIsReachable(handle))) {
            await clearDirectoryHandle();
            this.pending = null;
            this.status = 'needs-folder';
            this.error = m.welcome_folder_missing();
            return;
        }

        await this.#adopt(handle);
    }

    // Show the directory picker. Must be called from a user gesture.
    //
    // `subfolder` is what makes the welcome screen's "start a new folder" card
    // work: the picker cannot be pointed at a path, so we open it at Documents
    // and create the folder inside whatever the user actually picks.
    async chooseFolder({
        subfolder
    }: { subfolder?: string } = {}): Promise<void> {
        this.error = '';

        try {
            const picked = await window.showDirectoryPicker({
                id: 'dyslexicwriter',
                mode: 'readwrite',
                startIn: 'documents'
            });

            if (!(await ensurePermission(picked, { prompt: true }))) {
                this.error = m.welcome_permission_denied();
                return;
            }

            let handle = picked;
            if (subfolder) {
                try {
                    handle = await ensureSubfolder(picked, subfolder);
                } catch {
                    // A read-only volume, or a file already sitting there under
                    // that name. Either way the folder they picked is fine — it
                    // is only the one inside it we couldn't make.
                    this.error = m.welcome_folder_create_error();
                    return;
                }
            }

            await saveDirectoryHandle(handle);
            await this.#adopt(handle);
        } catch (cause) {
            // AbortError just means the user closed the picker — not an error.
            if (cause instanceof DOMException && cause.name === 'AbortError') {
                return;
            }

            // The browser refuses some locations outright — the Downloads
            // folder, the home folder itself, and system directories — because
            // handing a web page all of one of those leaks far more than a user
            // expects. Chrome usually blocks these inside its own picker dialog
            // ("this folder contains system files"), but it can also surface as
            // a SecurityError here. Either way the user needs to know it is the
            // folder that is the problem, not the app.
            this.error =
                cause instanceof DOMException && cause.name === 'SecurityError'
                    ? m.welcome_folder_blocked()
                    : m.welcome_folder_error();
        }
    }

    async #adopt(handle: FileSystemDirectoryHandle): Promise<void> {
        this.root = handle;
        // Whatever we were waiting to be let into, we are past it now.
        this.pending = null;
        // A different folder has a different tree; carrying the old one's open
        // and collapsed paths over would apply them to unrelated directories.
        this.tree = null;
        this.collapsed.clear();
        this.#opened.clear();
        this.config = await readConfig(handle);
        this.status = 'ready';
        this.error = '';
        this.applyTheme();
        await this.refresh();
    }

    // Let the working folder go: `#adopt()` in reverse.
    //
    // Nothing on disk is touched. All this does is make the browser forget the
    // folder, so the next launch starts at the picker rather than reopening it.
    //
    // CALLERS MUST FLUSH THE OPEN DOCUMENT FIRST — `await doc.close()` before
    // this, as the Files screen does. Dropping the handle while a debounced edit
    // is still pending loses that edit, which is the one failure this app exists
    // to avoid. The flush is not done here because this store must not import the
    // document store: that store already imports this one.
    async leaveFolder(): Promise<void> {
        // Before anything is reset, because this is the part that can fail. A
        // half-done exit that resets the screen but leaves the handle in
        // IndexedDB would quietly reopen the folder on the next launch — worse
        // than not leaving at all, so say so and stay put.
        try {
            await clearDirectoryHandle();
        } catch {
            this.error = m.files_leave_error();
            return;
        }

        this.root = null;
        this.pending = null;
        this.tree = null;
        this.collapsed.clear();
        this.#opened.clear();
        this.config = defaultConfig();
        this.status = 'needs-folder';
        this.error = '';
        // Deliberately no `applyTheme()`. Every preference lives in the folder's
        // config.json, so there is nothing to persist a theme to once we have let
        // it go — and flipping the page to the shipped default on the way out
        // reads as a fault rather than a consequence. <html> keeps what the user
        // was looking at until the next folder is adopted and its config decides.
    }

    // Push the stored theme onto <html>.
    //
    // Deliberately imperative rather than an $effect in the root layout: an
    // effect that reads the preference while mode-watcher mutates the same
    // element ends up re-triggering itself (effect_update_depth_exceeded). The
    // theme changes at exactly two moments — when a folder is adopted, and when
    // the user picks a setting — so we apply it at those two moments only.
    //
    // The font preference is not applied here: it belongs to the document
    // surface alone, which reads `workspace.font` reactively (see the editor's
    // `font` prop), rather than to the app chrome.
    applyTheme(): void {
        if (typeof document === 'undefined') return;

        setMode(this.config.theme);
    }

    // Reconcile the config index against what is actually on disk. The folder
    // wins: files may have been added, renamed or deleted outside the app.
    async refresh(): Promise<void> {
        if (!this.root) return;

        try {
            const tree = await scanFolder(this.root);
            await this.#replayOpened(tree);
            this.tree = tree;
            await this.#syncIndex();
        } catch {
            this.error = m.files_read_error();
        }
    }

    // Is this folder showing its contents? A folder the depth cap stopped at has
    // nothing to show yet, so it stays shut until the user asks for it.
    isExpanded(node: FolderNode): boolean {
        return node.loaded && !this.collapsed.has(node.path);
    }

    // Open or close a folder. Opening one the scan never reached walks another
    // few levels from there, which is what keeps the first scan cheap on a large
    // writing folder.
    async toggle(node: FolderNode): Promise<void> {
        if (node.loaded) {
            if (this.collapsed.has(node.path)) this.collapsed.delete(node.path);
            else this.collapsed.add(node.path);
            return;
        }

        if (!this.root) return;

        try {
            const loaded = await scanFolder(this.root, { path: node.path });
            node.folders = loaded.folders;
            node.documents = loaded.documents;
            node.loaded = true;
            this.#opened.add(node.path);
            this.collapsed.delete(node.path);
            await this.#syncIndex();
        } catch {
            this.error = m.files_read_error();
        }
    }

    // Note a document's new mtime without re-walking the tree.
    //
    // Autosave calls this after every write, and a depth-limited walk that stats
    // every markdown file it finds is far too much work to repeat on a 600ms
    // debounce. A document the tree has never seen — the first save of a new one —
    // falls back to a full refresh, because there is a folder to discover.
    async touch(entry: DocumentIndexEntry): Promise<void> {
        const known = this.tree && findDocument(this.tree, entry);

        if (!known) {
            await this.refresh();
            return;
        }

        known.lastModified = entry.lastModified;
        await this.#syncIndex();
    }

    // Re-open the folders the user had expanded past the depth cap. Each pass
    // loads at least one of them, and a loaded folder never goes back, so this
    // terminates on the size of the set.
    async #replayOpened(tree: FolderNode): Promise<void> {
        const root = this.root;
        if (!root || this.#opened.size === 0) return;

        for (;;) {
            const pending: FolderNode[] = [];
            const collect = (node: FolderNode): void => {
                if (!node.loaded && this.#opened.has(node.path)) {
                    pending.push(node);
                }
                node.folders.forEach(collect);
            };
            collect(tree);

            if (pending.length === 0) return;

            for (const node of pending) {
                const loaded = await scanFolder(root, { path: node.path });
                node.folders = loaded.folders;
                node.documents = loaded.documents;
                node.loaded = true;
            }
        }
    }

    // Write the index back to config.json when it no longer matches the tree. It
    // is only a cache for the Files screen, so there is nothing to salvage from a
    // stale one — it is replaced whole or left alone.
    async #syncIndex(): Promise<void> {
        const found = $state.snapshot(this.documents);
        const cached = this.config.documents;

        const changed =
            found.length !== cached.length ||
            found.some(
                (d, i) =>
                    d.folder !== cached[i]?.folder ||
                    d.file !== cached[i]?.file ||
                    d.lastModified !== cached[i]?.lastModified
            );

        if (changed) await this.#persist({ documents: found });
    }

    async setTheme(theme: Theme): Promise<void> {
        this.config = { ...this.config, theme };
        this.applyTheme();
        await this.#persist({ theme });
    }

    // No DOM work: the editor surface reads `font` from here reactively.
    async setFont(font: Font): Promise<void> {
        this.config = { ...this.config, font };
        await this.#persist({ font });
    }

    async setTtsPreferences(tts: Config['tts']): Promise<void> {
        this.config = { ...this.config, tts };
        await this.#persist({ tts });
    }

    // Settings are written to the user's folder, which can vanish mid-session
    // (unplugged drive, revoked permission). Surface it rather than throwing into
    // an event handler nobody is awaiting.
    async #persist(patch: Partial<Config>): Promise<void> {
        if (!this.root) return;

        try {
            this.config = await updateConfig(this.root, {
                ...this.config,
                ...patch
            });
        } catch {
            this.error = m.settings_save_error();
        }
    }
}

export const workspace = new WorkspaceStore();
