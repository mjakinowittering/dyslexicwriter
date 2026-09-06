import { setMode } from 'mode-watcher';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    clearDirectoryHandle,
    ensurePermission,
    loadDirectoryHandle,
    refreshConfig,
    saveDirectoryHandle,
    scanFolder,
    updateConfig,
    type FolderNode
} from '$lib/fs';
import { defaultConfig } from '$lib/models/config.model';
import * as m from '$lib/paraglide/messages';
import { workspace } from '$lib/stores/workspace.svelte';

// Leaving the working folder, against real IndexedDB and a real OPFS root.
//
// Nothing on disk may be touched by this — all it does is make the browser
// forget the folder. What is worth asserting is the ordering: the stored handle
// goes first, because that is the step that can fail, and a failure has to leave
// the workspace exactly as it was rather than resetting the screen around a
// folder the next launch will silently reopen.
//
// `$lib/fs` is mocked through to the real module so `clearDirectoryHandle` and
// `refreshConfig` can be made to reject on demand and `updateConfig` can be watched;
// every other export is the genuine one. `ensurePermission` is here because an
// OPFS handle does not answer `queryPermission`, and `restore()` will not reach
// the folder without it.
vi.mock('$lib/fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('$lib/fs')>();
    return {
        ...actual,
        clearDirectoryHandle: vi.fn(actual.clearDirectoryHandle),
        ensurePermission: vi.fn(actual.ensurePermission),
        refreshConfig: vi.fn(actual.refreshConfig),
        // Stubbed outright in the adopt tests. The OPFS root these use is shared
        // with the fs suites on purpose (see below), so walking it for real would
        // race them; what is under test here is what `#adopt` does with the
        // config it got, not what the scan found.
        scanFolder: vi.fn(actual.scanFolder),
        updateConfig: vi.fn(actual.updateConfig)
    };
});

// The theme is pushed onto <html> through mode-watcher, and the case that matters
// is the one where it must NOT be — a folder whose settings could not be read has
// no theme to apply.
vi.mock('mode-watcher', () => ({ setMode: vi.fn() }));

let root: FileSystemDirectoryHandle;

beforeEach(async () => {
    // A genuine FileSystemDirectoryHandle, but deliberately NOT the wiped root the
    // fs suites use: leaving a folder never reads or writes it, so there is
    // nothing to arrange on disk and nothing to clear up. Racing the other suites
    // for OPFS here would only make both flaky.
    root = await navigator.storage.getDirectory();

    await saveDirectoryHandle(root);
    workspace.root = root;
    workspace.pending = null;
    workspace.tree = node();
    workspace.collapsed.add('Book');
    workspace.status = 'ready';
    workspace.error = '';
    workspace.settingsUnreadable = false;
});

// A folder node with nothing in it, for the tests that only care about the shape
// of the tree rather than what is on disk.
function node(contents: Partial<FolderNode> = {}): FolderNode {
    return {
        name: '',
        path: '',
        folders: [],
        documents: [],
        loaded: true,
        hasOtherEntries: false,
        ...contents
    };
}

afterEach(async () => {
    vi.mocked(clearDirectoryHandle).mockClear();
    vi.mocked(ensurePermission).mockReset();
    vi.mocked(refreshConfig).mockReset();
    vi.mocked(scanFolder).mockReset();
    vi.mocked(updateConfig).mockReset();
    vi.mocked(setMode).mockClear();
    vi.restoreAllMocks();
    // A handle left in IndexedDB would outlive this suite entirely.
    await clearDirectoryHandle();
    workspace.root = null;
    workspace.tree = null;
    workspace.collapsed.clear();
});

describe('leaveFolder', () => {
    it('deletes the stored handle so the next launch starts at the picker', async () => {
        await workspace.leaveFolder();

        await expect(loadDirectoryHandle()).resolves.toBeNull();
    });

    it('resets the workspace back to the first-run state', async () => {
        await workspace.leaveFolder();

        expect({
            status: workspace.status,
            root: workspace.root,
            pending: workspace.pending,
            tree: workspace.tree,
            collapsed: workspace.collapsed.size,
            config: workspace.config,
            error: workspace.error
        }).toEqual({
            status: 'needs-folder',
            root: null,
            pending: null,
            tree: null,
            collapsed: 0,
            config: defaultConfig(),
            error: ''
        });
    });

    it('leaves the workspace untouched when the handle cannot be dropped', async () => {
        vi.mocked(clearDirectoryHandle).mockRejectedValueOnce(
            new Error('IndexedDB is unavailable')
        );

        await workspace.leaveFolder();

        // Still in the folder, and told why — resetting around a handle that is
        // still stored would reopen it on the next launch.
        expect({
            status: workspace.status,
            root: workspace.root,
            error: workspace.error
        }).toEqual({
            status: 'ready',
            root,
            error: m.files_leave_error()
        });
    });
});

// What the Files screen shows when the tree holds no documents. Read off the root
// of the tree rather than a flat document count, because the two disagree in the
// case that matters: a folder the depth cap stopped at holds no documents yet and
// is exactly the row the user needs in order to find their writing.
describe('isEmpty', () => {
    it('is true when the working folder holds nothing at all', () => {
        workspace.tree = node();

        expect(workspace.isEmpty).toBe(true);
    });

    it('is true before the first scan resolves', () => {
        workspace.tree = null;

        expect(workspace.isEmpty).toBe(true);
    });

    it('is false when a folder row is waiting, even with no documents', () => {
        // The depth cap stopped here. Counting documents alone would replace this
        // row with "Nothing here yet" and hide the only way to reach what is
        // inside it.
        workspace.tree = node({
            folders: [node({ name: 'Book', path: 'Book', loaded: false })]
        });

        expect(workspace.isEmpty).toBe(false);
    });

    it('reports whether the scan saw anything it cannot open', () => {
        workspace.tree = node({ hasOtherEntries: true });

        expect(workspace.hasUnopenableFiles).toBe(true);
    });
});

// Adopting a folder whose config.json could not be read.
//
// The whole point is that this is NOT first run. A folder with no settings file
// gets the shipped defaults and means it; a folder whose settings we could not
// read gets the same defaults as a stand-in, and every consequence has to be
// different — the theme is not the user's to guess at, and nothing may be written
// back over preferences that are probably sitting on disk intact.
describe('#adopt, when the settings cannot be read', () => {
    beforeEach(() => {
        vi.mocked(ensurePermission).mockResolvedValue(true);
        vi.mocked(scanFolder).mockResolvedValue(node());
    });

    it('opens the folder anyway, flagged, and says why', async () => {
        vi.mocked(refreshConfig).mockRejectedValue(
            new DOMException(
                'the folder is no longer available',
                'NotAllowedError'
            )
        );

        await workspace.restore();

        // Still ready: the settings file is not the writing, and refusing to
        // open the folder over it would cost the user far more than it saved.
        expect({
            status: workspace.status,
            settingsUnreadable: workspace.settingsUnreadable,
            error: workspace.error
        }).toEqual({
            status: 'ready',
            settingsUnreadable: true,
            error: m.settings_read_error()
        });
    });

    it('leaves the theme where it was rather than flipping to a default', async () => {
        vi.mocked(refreshConfig).mockRejectedValue(
            new DOMException(
                'the folder is no longer available',
                'NotAllowedError'
            )
        );

        await workspace.restore();

        expect(setMode).not.toHaveBeenCalled();
    });

    it('applies the theme as usual when the settings do read', async () => {
        vi.mocked(refreshConfig).mockResolvedValue({
            ...defaultConfig(),
            theme: 'light'
        });

        await workspace.restore();

        expect(setMode).toHaveBeenCalledWith('light');
        expect(workspace.settingsUnreadable).toBe(false);
    });

    // Adopting is where the file catches up with the preferences this version
    // knows about — the folder is the one place the settings live, so a setting
    // added since it was last opened has to reach it without the user having to
    // change something else first. The behaviour itself is covered against real
    // files in the fs suite; this pins that `#adopt` is what triggers it.
    it('brings the settings file up to date with this version', async () => {
        await workspace.restore();

        expect(refreshConfig).toHaveBeenCalledWith(root);
    });
});

describe('#persist', () => {
    // Stubbed rather than real: the root here is shared OPFS (see beforeEach), so
    // a genuine config.json write would race the fs suites. What these assert is
    // the shape of the call and what the store does with the answer.
    beforeEach(() => {
        vi.mocked(updateConfig).mockResolvedValue(defaultConfig());
    });

    // The patch, never the whole in-memory config. `updateConfig` merges onto
    // what is on disk right now, and handing it everything the store holds would
    // override that merge — which is how a session that started from defaults
    // wrote them over the user's real preferences, one switch at a time.
    it('hands updateConfig the one setting that changed', async () => {
        await workspace.setFont('sans');

        expect(updateConfig).toHaveBeenCalledWith(root, { font: 'sans' });
    });

    it('says the settings could not be read when that is why the write failed', async () => {
        workspace.settingsUnreadable = true;
        vi.mocked(updateConfig).mockRejectedValueOnce(
            new DOMException(
                'the folder is no longer available',
                'NotAllowedError'
            )
        );

        await workspace.setTheme('light');

        expect(workspace.error).toBe(m.settings_read_error());
    });

    // A write that got through read the file to merge onto it, so whatever was
    // wrong with it is over — a transient failure has to be able to end.
    it('clears the flag once a write reads the file successfully', async () => {
        workspace.settingsUnreadable = true;

        await workspace.setFont('sans');

        expect(workspace.settingsUnreadable).toBe(false);
    });
});

describe('touch', () => {
    const entry = {
        title: 'Notes',
        folder: '',
        file: 'notes.md',
        ownsFolder: false,
        lastModified: 1_700_000_000_000
    };

    // The tree is the only copy of this list. Autosave calls touch() after every
    // single write, so a config.json read-and-write here would put an extra round
    // trip to the user's disk behind every keystroke that lands.
    it('moves the row in memory without writing to disk', async () => {
        workspace.tree = node({ documents: [{ ...entry }] });

        await workspace.touch({ ...entry, lastModified: 1_700_000_009_999 });

        expect(workspace.tree?.documents[0]?.lastModified).toBe(
            1_700_000_009_999
        );
        expect(updateConfig).not.toHaveBeenCalled();
    });
});

// A working folder that is no longer there.
//
// Permission outlives the folder itself: a deleted folder, one renamed in the
// file manager and a drive or WSL share that isn't mounted all still report
// 'granted', so nothing upstream of a read can tell us. These run against a real
// OPFS directory that is created and then removed, which is as close to the
// writer's situation as this can get — the handle is genuine and the folder
// behind it is gone.
describe('a working folder that has gone', () => {
    let missing: FileSystemDirectoryHandle;

    beforeEach(async () => {
        // A name of this suite's own: the fs suites wipe the OPFS root between
        // tests, and a shared name would have them racing for it.
        const name = 'gone-workspace-store';
        missing = await root.getDirectoryHandle(name, { create: true });

        try {
            await root.removeEntry(name, { recursive: true });
        } catch {
            // Another suite's cleanup got there first, which is the same
            // outcome: the handle now points at nothing.
        }

        workspace.root = null;
        workspace.tree = null;
        workspace.status = 'loading';
    });

    // Everything `#adopt` does next swallows its own errors, so a folder adopted
    // here fails silently: refreshConfig hands back the shipped defaults, and a
    // writer on the light theme watches the app go dark on the way past.
    it('is not adopted on restore, and keeps the stored handle', async () => {
        await saveDirectoryHandle(missing);

        await workspace.restore();

        expect({
            status: workspace.status,
            root: workspace.root,
            name: workspace.pendingName
        }).toEqual({
            status: 'folder-missing',
            root: null,
            name: 'gone-workspace-store'
        });
        // Deliberately still in IndexedDB: an unmounted drive comes back at the
        // same path, and throwing the handle away makes the writer re-pick a
        // folder we already had.
        await expect(loadDirectoryHandle()).resolves.not.toBeNull();
    });

    it('moves the whole screen to the missing state when a scan finds nothing', async () => {
        workspace.root = missing;
        workspace.status = 'ready';
        workspace.tree = node();

        await workspace.refresh();

        expect({
            status: workspace.status,
            tree: workspace.tree,
            error: workspace.error
        }).toEqual({
            status: 'folder-missing',
            tree: null,
            error: ''
        });
        // The handle is kept rather than nulled: the document store gives up
        // quietly on a null root, so a pending write would vanish instead of
        // failing where the editor can say so.
        expect(workspace.root).toBe(missing);
    });

    it('says so and stays put when the folder still cannot be found', async () => {
        await saveDirectoryHandle(missing);
        workspace.pending = missing;
        workspace.status = 'folder-missing';

        await workspace.reopen();

        expect({
            status: workspace.status,
            error: workspace.error
        }).toEqual({
            status: 'folder-missing',
            error: m.files_missing_error()
        });
        await expect(loadDirectoryHandle()).resolves.not.toBeNull();
    });

    it('is adopted again once it comes back', async () => {
        const back = await root.getDirectoryHandle('back-workspace-store', {
            create: true
        });
        workspace.root = back;
        workspace.status = 'folder-missing';

        await workspace.reopen();

        expect({
            status: workspace.status,
            root: workspace.root,
            pending: workspace.pending
        }).toEqual({
            status: 'ready',
            root: back,
            pending: null
        });

        await root.removeEntry('back-workspace-store', { recursive: true });
    });

    // The other reason a scan throws, and the one that must NOT escalate: a
    // rename writes the new name and removes the old one a beat later, so a walk
    // landing between the two trips over an entry that has just gone.
    it('keeps the ordinary read error when the folder is still there', async () => {
        vi.mocked(scanFolder).mockRejectedValueOnce(
            new Error('entry vanished mid-rename')
        );
        workspace.root = root;
        workspace.status = 'ready';

        await workspace.refresh();

        expect({
            status: workspace.status,
            error: workspace.error
        }).toEqual({
            status: 'ready',
            error: m.files_read_error()
        });
    });
});

// Picking a working folder — the one path into the app that starts from nothing.
//
// `showDirectoryPicker` does not exist in the test browser and could not be
// answered if it did, so it is stubbed. Everything downstream of the pick is the
// real store: what it adopts, what it saves, and what it says when the pick does
// not work out. The distinction the error cases draw is the point — a user who
// closed the picker has not hit a problem, and a folder the browser refuses is
// the folder's fault rather than the app's.
describe('chooseFolder', () => {
    let picked: FileSystemDirectoryHandle;

    beforeEach(async () => {
        picked = await root.getDirectoryHandle('picked-workspace-store', {
            create: true
        });
        vi.mocked(ensurePermission).mockResolvedValue(true);
        vi.mocked(refreshConfig).mockResolvedValue(defaultConfig());
        vi.mocked(scanFolder).mockResolvedValue(node());
        vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(picked));
        workspace.root = null;
        workspace.status = 'needs-folder';
    });

    afterEach(async () => {
        vi.unstubAllGlobals();
        try {
            await root.removeEntry('picked-workspace-store', {
                recursive: true
            });
        } catch {
            // Already gone; nothing to undo.
        }
    });

    it('adopts the folder and remembers it for the next launch', async () => {
        await workspace.chooseFolder();

        expect({
            status: workspace.status,
            root: workspace.root,
            error: workspace.error
        }).toEqual({ status: 'ready', root: picked, error: '' });
        // Without this the picker comes back every launch, which is the one
        // thing the stored handle exists to prevent.
        await expect(loadDirectoryHandle()).resolves.not.toBeNull();
    });

    // Closing the picker is a decision, not a failure. Saying "couldn't open
    // that folder" to someone who changed their mind is the app inventing a
    // problem they did not have.
    it('says nothing when the user closes the picker', async () => {
        vi.mocked(window.showDirectoryPicker).mockRejectedValue(
            new DOMException('user aborted', 'AbortError')
        );

        await workspace.chooseFolder();

        expect({
            error: workspace.error,
            root: workspace.root,
            status: workspace.status
        }).toEqual({ error: '', root: null, status: 'needs-folder' });
    });

    // Chrome blocks Documents, Downloads and the home folder in its own dialog,
    // so this usually never reaches us — but where it does, the writer needs to
    // know it is the folder that is the problem and not the app.
    it('names the folder as the problem when the browser refuses it', async () => {
        vi.mocked(window.showDirectoryPicker).mockRejectedValue(
            new DOMException('blocked', 'SecurityError')
        );

        await workspace.chooseFolder();

        expect(workspace.error).toBe(m.welcome_folder_blocked());
    });

    it('falls back to the general message for any other failure', async () => {
        vi.mocked(window.showDirectoryPicker).mockRejectedValue(
            new Error('something else entirely')
        );

        await workspace.chooseFolder();

        expect(workspace.error).toBe(m.welcome_folder_error());
    });

    it('adopts nothing when permission is refused', async () => {
        vi.mocked(ensurePermission).mockResolvedValue(false);

        await workspace.chooseFolder();

        expect({
            error: workspace.error,
            root: workspace.root
        }).toEqual({ error: m.welcome_permission_denied(), root: null });
    });

    // The "start a new folder" card: the picker cannot be pointed at a path, so
    // the folder is made inside whatever the user actually picks — and it is
    // that inner folder that gets adopted, never the parent.
    it('creates the subfolder and adopts that rather than the pick', async () => {
        await workspace.chooseFolder({ subfolder: 'DyslexicWriter' });

        expect(workspace.root?.name).toBe('DyslexicWriter');
        expect(workspace.status).toBe('ready');
        await expect(
            picked.getDirectoryHandle('DyslexicWriter')
        ).resolves.toBeDefined();
    });

    // A read-only volume, or a file already sitting there under that name. The
    // folder they picked is fine — it is only the one inside it we couldn't make
    // — so nothing is adopted and the message says which half failed.
    it('adopts nothing when the subfolder cannot be created', async () => {
        // A *file* of that name: getDirectoryHandle then fails on a real folder,
        // which is exactly the collision the store is guarding against.
        const writable = await (
            await picked.getFileHandle('Taken', { create: true })
        ).createWritable();
        await writable.close();

        await workspace.chooseFolder({ subfolder: 'Taken' });

        expect({
            error: workspace.error,
            root: workspace.root
        }).toEqual({ error: m.welcome_folder_create_error(), root: null });
    });
});

// Expanding and collapsing folders on the Files screen.
//
// Two quite different jobs behind one method: a folder the scan already loaded
// just flips a flag, while one the depth cap stopped at has to be walked before
// it can show anything. The second is what keeps the first scan cheap on a large
// writing folder, so it is the half worth driving against a real directory.
describe('toggle', () => {
    // The suite mocks `scanFolder` for the tests above and resets it after each
    // one; these need the genuine walk, so it is put back.
    const realScan = async (
        ...args: Parameters<typeof scanFolder>
    ): Promise<FolderNode> => {
        const actual =
            await vi.importActual<typeof import('$lib/fs')>('$lib/fs');
        return actual.scanFolder(...args);
    };

    it('collapses a loaded folder and opens it again', async () => {
        const folder = node({ name: 'Book', path: 'Book' });
        workspace.tree = node({ folders: [folder] });
        workspace.collapsed.clear();

        await workspace.toggle(folder);
        expect(workspace.isExpanded(folder)).toBe(false);

        await workspace.toggle(folder);
        expect(workspace.isExpanded(folder)).toBe(true);
    });

    // A folder the cap stopped at knows nothing about its contents, so it stays
    // shut until asked — and asking is what fetches them.
    it('walks a folder the depth cap stopped at', async () => {
        vi.mocked(scanFolder).mockImplementation(realScan);
        const deep = await root.getDirectoryHandle('toggle-workspace-store', {
            create: true
        });
        const writable = await (
            await deep.getFileHandle('Chapter.md', { create: true })
        ).createWritable();
        await writable.write('# Chapter');
        await writable.close();

        const folder = node({
            name: 'toggle-workspace-store',
            path: 'toggle-workspace-store',
            loaded: false
        });
        workspace.tree = node({ folders: [folder] });

        // Nothing is known about it yet, so it cannot be showing anything.
        expect(workspace.isExpanded(folder)).toBe(false);

        await workspace.toggle(folder);

        expect(folder.loaded).toBe(true);
        expect(folder.documents.map((d) => d.title)).toEqual(['Chapter']);
        expect(workspace.isExpanded(folder)).toBe(true);

        await root.removeEntry('toggle-workspace-store', { recursive: true });
    });

    // A walk that throws against a folder that is still there is a bad moment,
    // not a missing folder — same distinction `refresh` draws.
    it('reports a failed walk without losing the folder', async () => {
        vi.mocked(scanFolder).mockRejectedValueOnce(
            new Error('entry vanished mid-rename')
        );
        workspace.root = root;
        workspace.status = 'ready';
        const folder = node({ name: 'Book', path: 'Book', loaded: false });
        workspace.tree = node({ folders: [folder] });

        await workspace.toggle(folder);

        expect({
            status: workspace.status,
            error: workspace.error,
            loaded: folder.loaded
        }).toEqual({
            status: 'ready',
            error: m.files_read_error(),
            loaded: false
        });
    });
});

// Re-opening, after a rescan, the folders the user expanded past the depth cap.
//
// The Files screen rescans on mount and on window focus, and a fresh scan knows
// nothing about what the user opened by hand — so without this every refresh
// folds the tree back up under them.
//
// The loop is what makes a folder nested inside another expanded one reachable:
// the first pass cannot even see it, because its parent has not been walked yet.
// These run against a chain of real directories deep enough that the cap
// genuinely stops partway, which is the only way that second pass happens.
describe('#replayOpened', () => {
    const BASE = 'replay-workspace-store';
    let base: FileSystemDirectoryHandle;

    // The scan is stubbed for the tests above and reset after each one; the walk
    // has to be the real one here.
    beforeEach(async () => {
        vi.mocked(scanFolder).mockImplementation(async (...args) => {
            const actual =
                await vi.importActual<typeof import('$lib/fs')>('$lib/fs');
            return actual.scanFolder(...args);
        });

        base = await root.getDirectoryHandle(BASE, { create: true });
        // A chain of nine, with the document at the bottom. Rooted at `base`
        // rather than the shared OPFS root, so the fs suites wiping that root
        // cannot race this walk.
        let dir = base;
        for (let level = 1; level <= 9; level += 1) {
            dir = await dir.getDirectoryHandle(`d${level}`, { create: true });
        }
        const writable = await (
            await dir.getFileHandle('Buried.md', { create: true })
        ).createWritable();
        await writable.write('# Buried');
        await writable.close();

        workspace.root = base;
        workspace.tree = null;
    });

    afterEach(async () => {
        try {
            await root.removeEntry(BASE, { recursive: true });
        } catch {
            // Already gone; nothing to undo.
        }
    });

    // Walk down a chain of `dN` folders from the scanned tree.
    const at = (levels: number): FolderNode | undefined => {
        let node = workspace.tree ?? undefined;
        for (let level = 1; level <= levels; level += 1) {
            node = node?.folders.find((f) => f.name === `d${level}`);
        }
        return node;
    };

    it('keeps a folder the user expanded open across a refresh', async () => {
        await workspace.refresh();
        // SCAN_DEPTH is 3, so the walk loads d1..d3 and stops with d4 a stub.
        expect(at(4)?.loaded).toBe(false);

        await workspace.toggle(at(4)!);
        expect(at(4)?.loaded).toBe(true);

        await workspace.refresh();

        // Without the replay this is false again and the tree has folded up
        // under a user who never asked it to.
        expect(at(4)?.loaded).toBe(true);
    });

    // The reason the loop is a loop. d8 sits below d4 and is invisible to a
    // fresh scan, so the pass that loads d4 is the one that reveals it — and it
    // takes another pass to load. A single pass leaves the document unreachable.
    it('reaches a folder only the previous pass could reveal', async () => {
        await workspace.refresh();
        await workspace.toggle(at(4)!);
        // Expanding d4 walked three more levels, so d8 is now the stub.
        expect(at(8)?.loaded).toBe(false);
        await workspace.toggle(at(8)!);

        await workspace.refresh();

        expect(at(8)?.loaded).toBe(true);
        expect(at(9)?.documents.map((d) => d.title)).toEqual(['Buried']);
    });
});
