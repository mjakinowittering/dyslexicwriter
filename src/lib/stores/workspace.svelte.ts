import { setMode } from 'mode-watcher';
import { SvelteSet } from 'svelte/reactivity';

import {
    clearDirectoryHandle,
    ensurePermission,
    ensureSubfolder,
    findDocument,
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
    type Font,
    type Theme
} from '$lib/models/config.model';
import type { DocumentIndexEntry } from '$lib/models/document.model';
import * as m from '$lib/paraglide/messages';

// The user's chosen working folder, the settings read from it, and the document
// tree shown on the Files screen.
//
// Everything here is derived from two things on the user's machine: the directory
// handle (in IndexedDB) and config.json (in the folder itself). Nothing is cached
// anywhere else — the tree in particular is scanned from the folder and held only
// in memory, because the folder is the only authority there has ever been for it.

export type WorkspaceStatus =
    | 'loading' // checking IndexedDB for a previously chosen folder
    | 'unsupported' // browser has no File System Access API
    | 'needs-folder' // first run, or the stored folder was given up on
    | 'needs-permission' // a stored folder we may not touch until the user says so
    | 'folder-missing' // a stored folder we are allowed to read and cannot find
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
    // A folder walk is in flight. The Files screen disables its refresh control
    // while this is true, and its automatic triggers stand down rather than
    // stacking a second walk on top of the first.
    scanning = $state(false);

    // Folders the depth cap stopped at that the user has since expanded. Replayed
    // after each refresh so a rescan doesn't fold the tree back up.
    #opened = new Set<string>();

    // Is the working folder showing nothing at all?
    //
    // Read off the root of the tree rather than a flattened document count: the
    // scan keeps any folder with writing below it, and lifts a folder holding one
    // document up into this level, so no documents AND no folders here means there
    // is genuinely nothing to show. Counting documents alone would hide the folder
    // rows the depth cap left unloaded — the one control that would find writing
    // sitting deeper than the scan reached.
    get isEmpty(): boolean {
        return (
            !this.tree ||
            (this.tree.documents.length === 0 && this.tree.folders.length === 0)
        );
    }

    // Did the scan see anything it cannot open? What separates a folder that is
    // empty from one holding a pile of .docx files.
    get hasUnopenableFiles(): boolean {
        return this.tree?.hasOtherEntries ?? false;
    }

    // The folder we are trying to get back into — one we have not been let into
    // yet ('needs-permission'), or one we were in and can no longer reach
    // ('folder-missing'). Only ever one of the two, so first non-null wins.
    get #candidate(): FileSystemDirectoryHandle | null {
        return this.pending ?? this.root;
    }

    // That folder's name, for the "Reopen …" card and the missing-folder screen.
    // A handle carries its name whether or not the folder is readable — or still
    // there at all — so there is nothing to remember separately and IndexedDB
    // still holds exactly one thing.
    get pendingName(): string {
        return this.#candidate?.name ?? '';
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

        // Permission survives the folder itself: a deleted folder, a renamed one
        // and an unmounted drive all still report 'granted'. Ask the folder
        // directly before adopting it, because everything `#adopt` does next
        // swallows its own errors — `readConfig` would quietly hand back the
        // shipped defaults and flip the user's theme on the way past.
        if (!(await folderIsReachable(handle))) {
            this.pending = handle;
            this.status = 'folder-missing';
            return;
        }

        await this.#adopt(handle);
    }

    // Ask for the stored folder back — the welcome screen's "Reopen" card, and
    // "Look again" on the missing-folder screen. Both are the user gesture
    // requestPermission needs; Chromium's "allow on every visit" grant then makes
    // `restore()` silent from the next visit on.
    async reopen(): Promise<void> {
        const handle = this.#candidate;
        if (!handle) return;

        // Whatever went wrong last time is about to be answered one way or the
        // other; leaving it up would have the screen explaining a refusal the
        // user is in the middle of retrying.
        this.error = '';

        if (!(await ensurePermission(handle, { prompt: true }))) {
            this.error = m.welcome_permission_denied();
            return;
        }

        // Permission can be granted for a folder that is no longer there, so ask
        // the folder directly before committing to it.
        //
        // The handle is deliberately kept. Nothing here can tell a folder that
        // has been deleted from one on a drive or a WSL share that simply isn't
        // mounted this minute, and the second comes back at the same path — so
        // the missing-folder screen holds on to it and offers both ways out
        // rather than throwing away a folder the user may be about to plug in.
        if (!(await folderIsReachable(handle))) {
            this.pending = handle;
            this.status = 'folder-missing';
            this.error = m.files_missing_error();
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

            // The browser refuses some locations outright — Documents, the
            // Downloads folder, the home folder itself, and system directories
            // — because handing a web page all of one of those leaks far more
            // than a user expects. Chrome blocks these in its own dialog and
            // then reopens the picker, so that refusal never reaches us at all
            // and the eventual rejection is an indistinguishable AbortError;
            // `welcome_folder_hint` says so up front for that reason. It can
            // still surface as a SecurityError here, and then the user needs to
            // know it is the folder that is the problem, not the app.
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

    // Re-walk the working folder. Files may have been added, renamed or deleted
    // outside the app since the last look, and the API offers no notification when
    // they are — so this is what the Files screen calls to catch up.
    //
    // Deliberately not guarded by `scanning`: `touch()` and the screen's own
    // refresh control must always do their work. It is the automatic triggers that
    // stand down, because they are the ones that can fire in bursts.
    async refresh(): Promise<void> {
        if (!this.root) return;

        this.scanning = true;

        try {
            const tree = await scanFolder(this.root);
            await this.#replayOpened(tree);
            this.tree = tree;
            this.#clearReadError();
        } catch {
            await this.#scanFailed();
        } finally {
            this.scanning = false;
        }
    }

    // A walk of the working folder threw. Two very different things look the same
    // from here, so ask the folder which one it is.
    //
    // A folder that answers is having a bad moment — a rename writes the new name
    // and removes the old one a beat later, and a scan landing between the two
    // fails on an entry that has just gone. That is the message we have always
    // shown, and the next scan clears it.
    //
    // A folder that does not answer is gone: deleted, renamed from underneath us,
    // or on a drive or WSL share that isn't mounted. There is nothing left for
    // this screen to show and no reason to keep offering to write into it, so the
    // whole app moves to the missing-folder state and offers a way back.
    //
    // `root` is deliberately left alone. The document store reads it on every
    // flush and gives up quietly when it is null — the one shape of failure this
    // app must never have — so it keeps the dead handle and lets the write throw
    // where the editor can say so.
    async #scanFailed(): Promise<void> {
        if (this.root && !(await folderIsReachable(this.root))) {
            this.tree = null;
            this.status = 'folder-missing';
            this.error = '';
            return;
        }

        this.error = m.files_read_error();
    }

    // The folder read fine, so a message saying it did not is no longer true —
    // and nothing else was ever going to take it off the screen. Only that one
    // message is cleared: another operation's failure is not this one's to
    // dismiss on its behalf.
    #clearReadError(): void {
        if (this.error === m.files_read_error()) this.error = '';
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
            node.hasOtherEntries = loaded.hasOtherEntries;
            this.#opened.add(node.path);
            this.collapsed.delete(node.path);
            this.#clearReadError();
        } catch {
            await this.#scanFailed();
        }
    }

    // Note a document's new mtime without re-walking the tree.
    //
    // Autosave calls this after every write, and a depth-limited walk that stats
    // every markdown file it finds is far too much work to repeat on a 600ms
    // debounce. A document the tree has never seen — the first save of a new one —
    // falls back to a full refresh, because there is a folder to discover.
    //
    // The tree is the only copy of this list, so moving the row here is the whole
    // job: nothing is written to disk, and the folder itself already has the mtime
    // we are catching up to.
    async touch(entry: DocumentIndexEntry): Promise<void> {
        const known = this.tree && findDocument(this.tree, entry);

        if (!known) {
            await this.refresh();
            return;
        }

        known.lastModified = entry.lastModified;
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
                node.hasOtherEntries = loaded.hasOtherEntries;
            }
        }
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
