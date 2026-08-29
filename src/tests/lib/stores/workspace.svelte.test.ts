import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    clearDirectoryHandle,
    loadDirectoryHandle,
    saveDirectoryHandle
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
// made to reject on demand; every other export is the genuine one.
vi.mock('$lib/fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('$lib/fs')>();
    return {
        ...actual,
        clearDirectoryHandle: vi.fn(actual.clearDirectoryHandle)
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
    workspace.tree = {
        name: '',
        path: '',
        folders: [],
        documents: [],
        loaded: true
    };
    workspace.collapsed.add('Book');
    workspace.status = 'ready';
    workspace.error = '';
});

afterEach(async () => {
    vi.mocked(clearDirectoryHandle).mockClear();
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
