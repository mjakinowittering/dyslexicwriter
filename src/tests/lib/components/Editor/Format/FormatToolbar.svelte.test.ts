import type { Editor, JSONContent } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import type { PreferenceStore } from '$lib/stores/workspace.svelte';

import FormatToolbarHarness from './FormatToolbarHarness.svelte';

// The collapsed formatting row: menus that show what the selection is, apply a
// choice to what was selected, and give the writing its focus back — plus ¶,
// which must agree with the Settings switch because it is the same preference.
//
// Keys and clicks are dispatched as DOM events rather than driven through
// Playwright (see ToolbarLocation's suite): suites share a browser, and a
// Playwright action on an iframe that isn't in front waits until it times out.

const doc = (...content: JSONContent[]): JSONContent => ({
    type: 'doc',
    content
});
const para = (text: string): JSONContent => ({
    type: 'paragraph',
    content: [{ type: 'text', text }]
});
const heading = (level: number, text: string): JSONContent => ({
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }]
});
const bullets = (text: string): JSONContent => ({
    type: 'bulletList',
    content: [{ type: 'listItem', content: [para(text)] }]
});

// A stand-in for the workspace's preferences: state, and nothing on disk.
function fakeStore(): PreferenceStore {
    const state = $state({ showInvisibles: false });
    return {
        theme: 'light',
        font: 'sans',
        settingsUnreadable: false,
        get showInvisibles() {
            return state.showInvisibles;
        },
        setTheme: async () => {},
        setFont: async () => {},
        setShowInvisibles: async (show) => {
            state.showInvisibles = show;
        }
    };
}

async function mount(content: JSONContent) {
    let editor: Editor | undefined;
    const store = fakeStore();
    const onPick = vi.fn(async () => null);
    const screen = await render(FormatToolbarHarness, {
        content,
        store,
        onPick,
        onReady: (instance: Editor) => {
            editor = instance;
        }
    });
    await vi.waitFor(() => expect(editor).toBeDefined());
    return { screen, editor: editor as Editor, store, onPick };
}

const key = (target: Element, name: string): void => {
    target.dispatchEvent(
        new KeyboardEvent('keydown', { key: name, bubbles: true })
    );
};

// Open a menu from the keyboard, the way the Enter or Space key does.
async function openMenu(name: RegExp, with_ = 'Enter'): Promise<HTMLElement> {
    const trigger = page.getByRole('button', { name }).element() as HTMLElement;
    trigger.focus();
    key(trigger, with_);
    const menu = page.getByRole('menu');
    await expect.element(menu).toBeVisible();
    return menu.element() as HTMLElement;
}

// Choose an item by its label, with Enter — as a keyboard user would.
async function choose(label: string): Promise<void> {
    const item = page
        .getByRole('menu')
        .getByText(label, { exact: true })
        .element()
        .closest('[role^="menuitem"]') as HTMLElement;
    item.focus();
    key(item, 'Enter');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('menu triggers', () => {
    it('name the text style in force', async () => {
        const { editor } = await mount(
            doc(heading(2, 'Chapter'), para('Body'))
        );

        editor.commands.setTextSelection(2);
        await expect
            .element(
                page.getByRole('button', { name: 'Text style: Heading 2' })
            )
            .toHaveTextContent('H2');

        editor.commands.setTextSelection(11);
        await expect
            .element(page.getByRole('button', { name: 'Text style: Text' }))
            .toHaveTextContent('Text');
    });

    it('press Lists while the selection is in a list, and say which', async () => {
        const { editor } = await mount(doc(bullets('One'), para('Body')));

        editor.commands.setTextSelection(3);
        await expect
            .element(page.getByRole('button', { name: 'Lists: Bullet list' }))
            .toHaveAttribute('aria-pressed', 'true');

        editor.commands.setTextSelection(9);
        await expect
            .element(page.getByRole('button', { name: /^Lists$/ }))
            .toHaveAttribute('aria-pressed', 'false');
    });

    it('press Blocks inside a code block, and say so', async () => {
        const { editor } = await mount(
            doc({
                type: 'codeBlock',
                content: [{ type: 'text', text: 'const a = 1;' }]
            })
        );

        editor.commands.setTextSelection(2);
        await expect
            .element(page.getByRole('button', { name: 'Blocks: Code block' }))
            .toHaveAttribute('aria-pressed', 'true');
    });

    it('give Insert no pressed state at all', async () => {
        await mount(doc(para('Body')));

        await expect
            .element(page.getByRole('button', { name: 'Insert' }))
            .not.toHaveAttribute('aria-pressed');
    });
});

describe('choosing an item', () => {
    it('applies it to the selection and hands focus back to the writing', async () => {
        const { editor } = await mount(doc(para('A line of prose')));
        editor.commands.setTextSelection({ from: 3, to: 7 });

        await openMenu(/^Text style/);
        await choose('Heading 2');

        expect(editor.isActive('heading', { level: 2 })).toBe(true);
        expect(editor.state.selection.from).toBe(3);
        expect(editor.state.selection.to).toBe(7);
        // Past the menu's close animation, so a late hand-back to the trigger
        // would have happened by now.
        await new Promise((resolve) => setTimeout(resolve, 400));
        expect(editor.view.hasFocus()).toBe(true);
    });

    it('hands focus back to the trigger when closed with Escape', async () => {
        await mount(doc(para('Body')));

        const menu = await openMenu(/^Lists/);
        key(menu, 'Escape');

        await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
        await expect
            .element(page.getByRole('button', { name: /^Lists/ }))
            .toHaveFocus();
    });

    it('takes a list off when the list in force is chosen again', async () => {
        const { editor } = await mount(doc(bullets('One')));
        editor.commands.setTextSelection(3);

        await openMenu(/^Lists/);
        await choose('Bullet list');

        expect(editor.isActive('bulletList')).toBe(false);
        expect(editor.getJSON().content?.[0]?.type).toBe('paragraph');
    });

    it('opens the file picker from Insert → Image', async () => {
        await mount(doc(para('Body')));
        const click = vi.spyOn(HTMLInputElement.prototype, 'click');

        await openMenu(/^Insert/);
        await choose('Image');

        expect(click).toHaveBeenCalledOnce();
        expect((click.mock.contexts[0] as HTMLInputElement).type).toBe('file');
    });

    it('focuses the link dialog from Insert → Link', async () => {
        const { editor } = await mount(doc(para('Body')));
        editor.commands.setTextSelection({ from: 1, to: 5 });

        await openMenu(/^Insert/);
        await choose('Link');

        const dialog = page.getByRole('dialog', { name: 'Add a link' });
        await expect.element(dialog).toBeVisible();
        await new Promise((resolve) => setTimeout(resolve, 400));
        expect(
            (dialog.element() as HTMLElement).contains(document.activeElement)
        ).toBe(true);
    });
});

describe('keyboard', () => {
    it.each([
        ['Text style', /^Text style/],
        ['Lists', /^Lists/],
        ['Blocks', /^Blocks/],
        ['Insert', /^Insert/]
    ])(
        'opens %s with Enter or Space, and arrows move through it',
        async (_name, name) => {
            await mount(doc(para('Body')));

            for (const opener of ['Enter', ' ']) {
                const menu = await openMenu(name, opener);
                const items = [
                    ...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')
                ];
                expect(items.length).toBeGreaterThan(1);

                items[0].focus();
                key(items[0], 'ArrowDown');
                await vi.waitFor(() =>
                    expect(document.activeElement).toBe(items[1])
                );

                key(document.activeElement as Element, 'Escape');
                await expect
                    .element(page.getByRole('menu'))
                    .not.toBeInTheDocument();
            }
        }
    );
});

describe('¶ and the Settings switch', () => {
    it('stay in step, whichever one is pressed', async () => {
        const { store } = await mount(doc(para('Body')));
        const pilcrow = page.getByRole('button', {
            name: 'Show invisible characters'
        });
        const toggle = page.getByRole('switch', {
            name: 'Show invisible characters'
        });

        (pilcrow.element() as HTMLElement).click();
        await expect.element(pilcrow).toHaveAttribute('aria-pressed', 'true');
        await expect.element(toggle).toBeChecked();
        expect(store.showInvisibles).toBe(true);

        (toggle.element() as HTMLElement).click();
        await expect.element(toggle).not.toBeChecked();
        await expect.element(pilcrow).toHaveAttribute('aria-pressed', 'false');
        expect(store.showInvisibles).toBe(false);
    });
});
