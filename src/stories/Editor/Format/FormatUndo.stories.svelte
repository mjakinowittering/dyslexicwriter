<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import Format from '$lib/components/Editor/Format/Format.svelte';
    import FormatGroup from '$lib/components/Editor/Format/FormatGroup.svelte';
    import FormatUndo from '$lib/components/Editor/Format/FormatUndo.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Format/FormatUndo',
        component: FormatUndo,
        tags: ['autodocs'],
        argTypes: {
            disabled: { control: 'boolean' },
            editor: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Undo button, first on the toolbar. The keyboard shortcut already works without it — this surfaces it for a writer who does not know Mod+Z. A one-shot action, so it never holds a pressed state. Disabled when there is nothing to undo, which is what a document looks like the moment it opens. Shown without a live editor, so clicks are no-ops.'
                }
            }
        }
    });
</script>

<Story
    name="Default"
    args={{ disabled: false, editor: undefined }}
    play={async ({ canvas }) => {
        const button = canvas.getByRole('button', {
            name: m.content_format_undo()
        });
        await expect(button).toBeEnabled();
        // An action, never a toggle: no pressed state to report.
        await expect(button).not.toHaveAttribute('aria-pressed');
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup>
                    <FormatUndo {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>

<Story
    name="Nothing to undo"
    args={{ disabled: true, editor: undefined }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_format_undo() })
        ).toBeDisabled();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup>
                    <FormatUndo {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>
