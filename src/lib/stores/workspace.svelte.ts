import { setMode } from 'mode-watcher';

import {
    ensurePermission,
    loadDirectoryHandle,
    readConfig,
    saveDirectoryHandle,
    scanFolder,
    updateConfig
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
    | 'needs-folder' // first run, or permission was declined/revoked
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
    config = $state<Config>(defaultConfig());
    documents = $state<DocumentIndexEntry[]>([]);
    error = $state('');

    get theme(): Theme {
        return this.config.theme;
    }

    get font(): Font {
        return this.config.font;
    }

    // Try to pick up where the user left off. A stored handle usually still has
    // its permission granted, in which case this is silent; if not we fall back to
    // the folder picker rather than prompting outside a user gesture (Chromium
    // rejects requestPermission without one).
    async restore(): Promise<void> {
        const handle = await loadDirectoryHandle();
        if (!handle) {
            this.status = 'needs-folder';
            return;
        }

        if (!(await ensurePermission(handle))) {
            this.status = 'needs-folder';
            return;
        }

        await this.#adopt(handle);
    }

    // Show the directory picker. Must be called from a user gesture.
    async chooseFolder(): Promise<void> {
        try {
            const handle = await window.showDirectoryPicker({
                id: 'dyslexicwriter',
                mode: 'readwrite',
                startIn: 'documents'
            });

            if (!(await ensurePermission(handle, { prompt: true }))) {
                this.error = m.welcome_permission_denied();
                return;
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
        this.config = await readConfig(handle);
        this.status = 'ready';
        this.error = '';
        this.applyTheme();
        await this.refresh();
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
            const found = await scanFolder(this.root);
            this.documents = found;

            const changed =
                found.length !== this.config.documents.length ||
                found.some(
                    (d, i) =>
                        d.folder !== this.config.documents[i]?.folder ||
                        d.lastModified !==
                            this.config.documents[i]?.lastModified
                );

            if (changed) await this.#persist({ documents: found });
        } catch {
            this.error = m.files_read_error();
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
