import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    clearDirectoryHandle,
    loadDirectoryHandle,
    saveDirectoryHandle,
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
// `$lib/fs` is mocked through to the real module so `clearDirectoryHandle` can be
// made to reject on demand and `updateConfig` can be watched; every other export
// is the genuine one.
vi.mock('$lib/fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('$lib/fs')>();
    return {
        ...actual,
        clearDirectoryHandle: vi.fn(actual.clearDirectoryHandle),
        updateConfig: vi.fn(actual.updateConfig)
    };
});

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
    vi.mocked(updateConfig).mockClear();
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
