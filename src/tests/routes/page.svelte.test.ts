import FilesPage from '../../routes/+page.svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import { scanFolder, type FolderNode } from '$lib/fs';
import type { DocumentIndexEntry } from '$lib/models/document.model';
import { workspace } from '$lib/stores/workspace.svelte';

// The Files screen's arrival from the editor's "Show in Files": `?reveal=` names
// a document, and the screen opens the folders down to it, announces it, and
// then takes the parameter back off the URL so a reload doesn't do it again.
//
// The scan is stubbed, so this suite never touches OPFS. The subject is the
// screen, and a real walk here would write into the origin the fs and autosave
// suites wipe and rescan — slowing their writes enough to fail their timing.
// `workspace.reveal`'s own suite covers the walk. SvelteKit's `$app` modules are
// stubbed too: this is about the screen, not the router.
const app = vi.hoisted(() => ({ url: new URL('http://localhost/') }));

vi.mock('$app/state', () => ({
    page: {
        get url() {
            return app.url;
        }
    }
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({ resolve: (route: string) => route }));
vi.mock('$lib/fs', async (importOriginal) => ({
    ...(await importOriginal<typeof import('$lib/fs')>()),
    scanFolder: vi.fn()
}));

const { goto } = await import('$app/navigation');

function doc(
    folder: string,
    file: string,
    ownsFolder = false
): DocumentIndexEntry {
    return {
        title: file.replace(/\.md$/, ''),
        folder,
        file,
        ownsFolder,
        lastModified: Date.now()
    };
}

function folder(path: string, contents: Partial<FolderNode> = {}): FolderNode {
    return {
        name: path.split('/').at(-1) ?? '',
        path,
        folders: [],
        documents: [],
        loaded: true,
        hasOtherEntries: false,
        ...contents
    };
}

// A folder-document inside Chapters, and one two walks past the depth cap:
// A is where the first scan stopped, and B is where walking A stops.
const walks: Record<string, () => FolderNode> = {
    '': () =>
        folder('', {
            folders: [
                folder('A', { loaded: false }),
                folder('Chapters', {
                    documents: [
                        doc(
                            'Chapters/The Lantern Room',
                            'The Lantern Room.md',
                            true
                        )
                    ]
                })
            ]
        }),
    A: () => folder('A', { folders: [folder('A/B', { loaded: false })] }),
    'A/B': () => folder('A/B', { documents: [doc('A/B', 'Deep.md')] })
};

beforeEach(async () => {
    vi.mocked(scanFolder).mockImplementation(async (_root, options) =>
        walks[options?.path ?? '']()
    );

    // A real handle for the store to hold; nothing is read from or written to it.
    workspace.root = await navigator.storage.getDirectory();
    workspace.status = 'ready';
    workspace.tree = null;
    workspace.collapsed.clear();
    workspace.error = '';
});

afterEach(() => {
    vi.mocked(goto).mockClear();
    vi.mocked(scanFolder).mockReset();
    app.url = new URL('http://localhost/');
    workspace.root = null;
    workspace.tree = null;
    workspace.status = 'loading';
});

const liveRegion = (): HTMLElement | null =>
    document.querySelector('[aria-live="polite"]');

const reveal = (path: string): URL =>
    new URL(`http://localhost/?reveal=${encodeURIComponent(path)}`);

describe('Files screen, arriving with ?reveal=', () => {
    it('opens the way, announces the row and clears the parameter', async () => {
        workspace.collapsed.add('Chapters');
        app.url = reveal('Chapters/The Lantern Room/The Lantern Room.md');

        render(FilesPage);

        await expect
            .element(
                page.getByRole('button', { name: /^The Lantern Room Edited/ })
            )
            .toHaveFocus();
        expect(liveRegion()?.textContent).toBe('The Lantern Room, in Chapters');
        expect(goto).toHaveBeenCalledWith('/', {
            replaceState: true,
            keepFocus: true,
            noScroll: true
        });
    });

    it('walks past the depth cap to a buried document', async () => {
        app.url = reveal('A/B/Deep.md');

        render(FilesPage);

        await expect
            .element(page.getByRole('button', { name: /^Deep Edited/ }))
            .toHaveFocus();
        expect(liveRegion()?.textContent).toBe('Deep, in B');
    });

    // Renamed or deleted outside the app since: nothing to show, and nothing
    // to say about it — but the parameter still goes.
    it('does nothing visible for a path that leads nowhere', async () => {
        app.url = reveal('Gone/Away.md');

        render(FilesPage);

        await expect.poll(() => vi.mocked(goto).mock.calls.length).toBe(1);
        expect(goto).toHaveBeenCalledWith('/', expect.anything());
        expect(liveRegion()?.textContent).toBe('');
        expect(document.querySelector('[data-arrival]')).toBeNull();
        expect(workspace.error).toBe('');
    });

    it('leaves the list alone with no parameter', async () => {
        render(FilesPage);

        await expect
            .element(
                page.getByRole('button', { name: 'Chapters', exact: true })
            )
            .toBeVisible();
        expect(goto).not.toHaveBeenCalled();
    });
});
