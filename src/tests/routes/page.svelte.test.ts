import FilesPage from '../../routes/+page.svelte';
import { writeRaw } from '../support/opfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import { workspace } from '$lib/stores/workspace.svelte';

// The Files screen's arrival from the editor's "Show in Files": `?reveal=` names
// a document, and the screen opens the folders down to it, announces it, and
// then takes the parameter back off the URL so a reload doesn't do it again.
//
// Driven against a real OPFS folder, scanned for real — the depth cap is only
// worth testing against a walk that genuinely stops. SvelteKit's `$app` modules
// are stubbed: this suite is about the screen, not the router.
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

const { goto } = await import('$app/navigation');

// Its own directory inside OPFS rather than the wiped root, so this suite never
// races the fs suites for the same files.
const FOLDER = 'files-arrival-route';
let root: FileSystemDirectoryHandle;

beforeEach(async () => {
    const opfs = await navigator.storage.getDirectory();
    root = await opfs.getDirectoryHandle(FOLDER, { create: true });

    // A folder-document inside Chapters, and one buried past the scan's cap.
    await writeRaw(
        root,
        'Chapters/The Lantern Room',
        'The Lantern Room.md',
        '# The Lantern Room'
    );
    await writeRaw(root, 'A/B/C/D/E', 'Deep.md', '# Deep');

    workspace.root = root;
    workspace.status = 'ready';
    workspace.tree = null;
    workspace.collapsed.clear();
    workspace.error = '';
});

afterEach(async () => {
    vi.mocked(goto).mockClear();
    app.url = new URL('http://localhost/');
    workspace.root = null;
    workspace.tree = null;
    workspace.status = 'loading';
    const opfs = await navigator.storage.getDirectory();
    await opfs.removeEntry(FOLDER, { recursive: true });
});

const liveRegion = (): HTMLElement | null =>
    document.querySelector('[aria-live="polite"]');

describe('Files screen, arriving with ?reveal=', () => {
    it('opens the way, announces the row and clears the parameter', async () => {
        workspace.collapsed.add('Chapters');
        app.url = new URL(
            'http://localhost/?reveal=' +
                encodeURIComponent(
                    'Chapters/The Lantern Room/The Lantern Room.md'
                )
        );

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
        app.url = new URL(
            'http://localhost/?reveal=' +
                encodeURIComponent('A/B/C/D/E/Deep.md')
        );

        render(FilesPage);

        await expect
            .element(page.getByRole('button', { name: /^Deep Edited/ }))
            .toHaveFocus();
        expect(liveRegion()?.textContent).toBe('Deep, in E');
    });

    // Renamed or deleted outside the app since: nothing to show, and nothing
    // to say about it — but the parameter still goes.
    it('does nothing visible for a path that leads nowhere', async () => {
        app.url = new URL(
            'http://localhost/?reveal=' + encodeURIComponent('Gone/Away.md')
        );

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
