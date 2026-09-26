import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import ToolbarLocation from '$lib/components/Editor/Toolbar/ToolbarLocation.svelte';

// The editor's folder button and its "Saved in" card. The path is shown the way
// the Files screen draws it — a folder-document is a row in its parent — and the
// card has to hand focus back to the button when it closes, or a keyboard user
// is dropped at the top of the page.
//
// Clicks and keys are dispatched as DOM events rather than driven through
// Playwright: suites run side by side in separate iframes, and a Playwright
// action on one that isn't in front waits until the test times out. A real
// click focuses the button too, which is what the card hands focus back to, so
// `open` does both.
const lantern = {
    folder: 'Chapters/The Lantern Room',
    file: 'The Lantern Room.md',
    ownsFolder: true
};

async function mount() {
    const onShowInFiles = vi.fn();
    const screen = await render(ToolbarLocation, {
        rootName: 'My writing',
        location: lantern,
        onShowInFiles
    });
    const button = screen.getByRole('button', {
        name: 'Saved in My writing, Chapters'
    });
    const open = (): void => {
        const element = button.element() as HTMLElement;
        element.focus();
        element.click();
    };
    return { ...screen, button, open, onShowInFiles };
}

describe('ToolbarLocation', () => {
    it('shows the folders, not the document’s own folder', async () => {
        const { button } = await mount();

        await expect
            .element(button)
            .toHaveTextContent(/My writing\s*\/\s*Chapters/);
        await expect.element(button).toHaveAttribute('aria-haspopup', 'dialog');
        await expect.element(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('lists every step in the card, ending on the file', async () => {
        const { button, open } = await mount();
        open();

        const card = page.getByRole('dialog', { name: 'Saved in' });
        await expect.element(card).toBeVisible();
        await expect.element(button).toHaveAttribute('aria-expanded', 'true');
        await expect
            .element(card.getByText('My writing', { exact: true }))
            .toBeVisible();
        await expect
            .element(card.getByText('Chapters', { exact: true }))
            .toBeVisible();
        expect(
            card.element().querySelector('[aria-current="location"]')
                ?.textContent
        ).toContain('The Lantern Room.md');
    });

    it('closes on Escape and gives focus back to the button', async () => {
        const { button, open } = await mount();
        open();
        await expect.element(page.getByRole('dialog')).toBeVisible();

        document.activeElement?.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );

        await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
        await expect.element(button).toHaveFocus();
    });

    it('asks to be shown in Files', async () => {
        const { open, onShowInFiles } = await mount();
        open();

        const show = page.getByRole('button', { name: 'Show in Files' });
        await expect.element(show).toBeVisible();
        (show.element() as HTMLElement).click();

        expect(onShowInFiles).toHaveBeenCalledOnce();
    });
});
