import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

import type { FileTreeActions } from '$lib/components/FileTree';
import FileTreeDocument from '$lib/components/FileTree/FileTreeDocument.svelte';

import type { DocumentIndexEntry } from '$lib/models/document.model';

// The row "Show in Files" lands on. It has to be found three ways — by eye
// (the wash), by keyboard (focus, so Enter reopens it) and by position (scrolled
// to the middle) — and it has to get out of the way the moment the writer does
// anything, or it is decoration standing over their next action.
//
// A key press is dispatched as a DOM event rather than driven through
// Playwright: suites run side by side in separate iframes, and a Playwright
// action on one that isn't in front waits until the test times out.
//
// `svelte/motion` is mocked so reduced motion can be switched per test; the
// rest of the module is the real one.
const motion = vi.hoisted(() => ({ reduced: false }));

vi.mock('svelte/motion', async (importOriginal) => {
    const actual = await importOriginal<typeof import('svelte/motion')>();
    return {
        ...actual,
        prefersReducedMotion: {
            get current() {
                return motion.reduced;
            }
        }
    };
});

const entry: DocumentIndexEntry = {
    title: 'The Lantern Room',
    folder: 'Chapters/The Lantern Room',
    file: 'The Lantern Room.md',
    ownsFolder: true,
    lastModified: Date.now()
};

const actions: FileTreeActions = {
    open: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
    newDocument: vi.fn(),
    newFolder: vi.fn(),
    deleteFolder: vi.fn()
};

const press = (): void => {
    document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Shift', bubbles: true })
    );
};

const wash = (container: HTMLElement): Element | null =>
    container.querySelector('[data-arrival]');

async function arrive() {
    const onArrived = vi.fn();
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    const screen = await render(FileTreeDocument, {
        entry,
        actions,
        arriving: true,
        onArrived
    });
    const open = screen.getByRole('button', {
        name: /^The Lantern Room Edited/
    });
    return { ...screen, onArrived, scroll, open };
}

afterEach(() => {
    motion.reduced = false;
    vi.restoreAllMocks();
});

describe('FileTreeDocument, arriving', () => {
    it('washes the row, centres it and takes focus', async () => {
        const { container, open, scroll } = await arrive();

        expect(wash(container)).not.toBeNull();
        await expect.element(open).toHaveFocus();
        expect(scroll).toHaveBeenCalledWith({
            block: 'center',
            behavior: 'smooth'
        });
    });

    it('lets go on its own: holds, fades, and says so', async () => {
        const { container, onArrived } = await arrive();

        await expect
            .poll(() => onArrived.mock.calls.length, { timeout: 5000 })
            .toBe(1);
        await expect.poll(() => wash(container)).toBeNull();
    });

    it('goes at once on a key press, without waiting for the fade', async () => {
        const { container, open, onArrived } = await arrive();
        await expect.element(open).toHaveFocus();

        press();

        // The poll gives up after 1s, before a 1.2s fade could finish.
        await expect.poll(() => wash(container)).toBeNull();
        expect(onArrived).toHaveBeenCalledOnce();
    });

    // No fade to watch, so it must not vanish between one glance and the next.
    it('stays until a key press under reduced motion', async () => {
        motion.reduced = true;
        const { container, open, scroll } = await arrive();
        await expect.element(open).toHaveFocus();
        expect(scroll).toHaveBeenCalledWith({
            block: 'center',
            behavior: 'instant'
        });

        await new Promise((done) => setTimeout(done, 2500));
        expect(wash(container)).not.toBeNull();

        press();
        await expect.poll(() => wash(container)).toBeNull();
    });
});
