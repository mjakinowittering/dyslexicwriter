<script lang="ts" module>
    import { makeEditor } from '../../support/editor';
    import { makePreferences } from '../../support/fakes.svelte';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, screen, userEvent } from 'storybook/test';

    import * as Format from '$lib/components/Editor/Format';
    import ToolbarRail from '$lib/components/Editor/Toolbar/ToolbarRail.svelte';
    import ToolbarReadAloud from '$lib/components/Editor/Toolbar/ToolbarReadAloud.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Format/FormatToolbar',
        tags: ['autodocs'],
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The whole formatting row as the editor draws it: undo/redo, the Text style menu, bold/italic/code, the Lists, Blocks and Insert menus, ¶, and the Read aloud button on the right (the transport it opens floats over the canvas). It is collapsed at every width, so it never changes shape. The width stories draw it in a window of that width beside the rail, with and without the settings panel’s 288px column, and assert that the last formatting control ends before the Read aloud button begins and the button ends inside the row — nothing is clipped.'
                }
            }
        }
    });

    // Where the row ends, measured. The ¶ toggle is the last formatting
    // control, so it must end before the Read aloud button begins; and that
    // button's right edge must sit inside the clipped row, or it is cut.
    async function expectNothingClipped(root: HTMLElement): Promise<void> {
        const pilcrow = root.querySelector<HTMLElement>(
            `[aria-label="${m.settings_invisibles_show()}"]`
        );
        const readAloud = root.querySelector<HTMLElement>(
            '[data-testid="read-aloud"]'
        );
        const clip = readAloud?.parentElement;
        await expect(pilcrow).not.toBeNull();
        await expect(readAloud).not.toBeNull();
        if (!pilcrow || !readAloud || !clip) return;

        const rowEnd =
            clip.getBoundingClientRect().right -
            parseFloat(getComputedStyle(clip).paddingRight);
        await expect(pilcrow.getBoundingClientRect().right).toBeLessThanOrEqual(
            readAloud.getBoundingClientRect().left
        );
        await expect(
            readAloud.getBoundingClientRect().right
        ).toBeLessThanOrEqual(rowEnd);
    }
</script>

<script lang="ts">
    import { onDestroy } from 'svelte';

    // The menus take their state from `active`, as they take `doc.formatting`
    // on the page, so each story pins what the selection is in.
    const editor = makeEditor();
    onDestroy(() => editor.destroy());

    const off = makePreferences();
    const on = makePreferences({ showInvisibles: true });

    const none = ['paragraph'];
    const inList = ['paragraph', 'orderedList'];
    const inCode = ['paragraph', 'codeBlock'];
    const inHeading = ['heading2', 'bold'];
</script>

{#snippet row(
    width: number,
    panel: boolean,
    active: string[],
    store: ReturnType<typeof makePreferences>
)}
    <div class="bg-background p-6">
        <div class="border-border flex border" style:width="{width}px">
            <ToolbarRail onBack={fn()} />
            <div class="min-w-0 flex-1">
                <div
                    class="-mt-1 flex items-center gap-2 overflow-hidden px-3 pt-1 pb-2"
                >
                    <Format.Root>
                        <Format.Group>
                            <Format.Undo disabled={false} {editor} />
                            <Format.Redo disabled={false} {editor} />
                        </Format.Group>
                        <Format.TextStyle {active} disabled={false} {editor} />
                        <Format.Group formatting={active}>
                            <Format.Bold disabled={false} {editor} />
                            <Format.Italic disabled={false} {editor} />
                            <Format.Code disabled={false} {editor} />
                        </Format.Group>
                        <Format.Lists {active} disabled={false} {editor} />
                        <Format.Blocks {active} disabled={false} {editor} />
                        <Format.InsertMenu
                            disabled={false}
                            {editor}
                            onOpenLink={fn()}
                            onPick={fn(async () => null)}
                        />
                        <Format.Invisibles {store} />
                    </Format.Root>
                    <div class="ml-auto" data-testid="read-aloud">
                        <ToolbarReadAloud onOpenChange={fn()} open={false} />
                    </div>
                </div>
            </div>
            {#if panel}
                <div class="border-border w-72 shrink-0 border-l"></div>
            {/if}
        </div>
    </div>
{/snippet}

<Story
    name="Width 1024 With Settings Panel"
    play={async ({ canvasElement }) => expectNothingClipped(canvasElement)}
>
    {#snippet template()}
        {@render row(1024, true, none, off)}
    {/snippet}
</Story>

<Story
    name="Width 1024"
    play={async ({ canvasElement }) => expectNothingClipped(canvasElement)}
>
    {#snippet template()}
        {@render row(1024, false, none, off)}
    {/snippet}
</Story>

<Story
    name="Width 1280 With Settings Panel"
    play={async ({ canvasElement }) => expectNothingClipped(canvasElement)}
>
    {#snippet template()}
        {@render row(1280, true, none, off)}
    {/snippet}
</Story>

<Story
    name="Width 1280"
    play={async ({ canvasElement }) => expectNothingClipped(canvasElement)}
>
    {#snippet template()}
        {@render row(1280, false, none, off)}
    {/snippet}
</Story>

<!-- The trigger reads the style in force, and the menu previews each style at
     its own size. -->
<Story
    name="Text Style Open"
    play={async ({ canvas }) => {
        const trigger = canvas.getByRole('button', {
            name: m.content_format_menu_label({
                menu: m.content_format_text_style_hint(),
                value: m.content_format_heading_hint({ level: 2 })
            })
        });
        await expect(trigger).toHaveTextContent(
            m.content_format_heading_short({ level: 2 })
        );
        await userEvent.click(trigger);
        await expect(
            await screen.findByRole('menuitemradio', {
                name: new RegExp(m.content_format_heading_hint({ level: 2 }))
            })
        ).toHaveAttribute('aria-checked', 'true');
    }}
>
    {#snippet template()}
        {@render row(1280, false, inHeading, off)}
    {/snippet}
</Story>

<!-- In a numbered list: the trigger shows its glyph and looks pressed. -->
<Story
    name="Lists Open"
    play={async ({ canvas }) => {
        const trigger = canvas.getByRole('button', {
            name: m.content_format_menu_label({
                menu: m.content_format_lists_hint(),
                value: m.content_format_ordered_list_hint()
            })
        });
        await expect(trigger).toHaveAttribute('aria-pressed', 'true');
        await userEvent.click(trigger);
        await expect(
            await screen.findByRole('menuitemcheckbox', {
                name: new RegExp(m.content_format_ordered_list_hint())
            })
        ).toHaveAttribute('aria-checked', 'true');
    }}
>
    {#snippet template()}
        {@render row(1280, false, inList, off)}
    {/snippet}
</Story>

<!-- In a code block: the trigger swaps to the code glyph and looks pressed. -->
<Story
    name="Blocks Open"
    play={async ({ canvas }) => {
        const trigger = canvas.getByRole('button', {
            name: m.content_format_menu_label({
                menu: m.content_format_blocks_hint(),
                value: m.content_format_code_block_hint()
            })
        });
        await expect(trigger).toHaveAttribute('aria-pressed', 'true');
        await userEvent.click(trigger);
        await expect(
            await screen.findByRole('menuitem', {
                name: m.content_format_horizontal_rule()
            })
        ).toBeInTheDocument();
    }}
>
    {#snippet template()}
        {@render row(1280, false, inCode, off)}
    {/snippet}
</Story>

<Story
    name="Insert Open"
    play={async ({ canvas }) => {
        const trigger = canvas.getByRole('button', {
            name: m.content_format_insert_hint()
        });
        await expect(trigger).not.toHaveAttribute('aria-pressed');
        await userEvent.click(trigger);
        for (const name of [
            m.content_format_table(),
            m.content_format_image(),
            m.content_format_link()
        ]) {
            await expect(
                await screen.findByRole('menuitem', { name: new RegExp(name) })
            ).toBeInTheDocument();
        }
    }}
>
    {#snippet template()}
        {@render row(1280, false, none, off)}
    {/snippet}
</Story>

<Story
    name="Invisibles On"
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.settings_invisibles_show() })
        ).toHaveAttribute('aria-pressed', 'true');
    }}
>
    {#snippet template()}
        {@render row(1280, false, none, on)}
    {/snippet}
</Story>

<Story
    name="Invisibles Off"
    play={async ({ canvas }) => {
        const pilcrow = canvas.getByRole('button', {
            name: m.settings_invisibles_show()
        });
        await expect(pilcrow).toHaveAttribute('aria-pressed', 'false');
        await userEvent.click(pilcrow);
        await expect(off.setShowInvisibles).toHaveBeenCalledWith(true);
        await expect(pilcrow).toHaveAttribute('aria-pressed', 'true');
    }}
>
    {#snippet template()}
        {@render row(1280, false, none, off)}
    {/snippet}
</Story>
