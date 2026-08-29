<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import Format from '$lib/components/Editor/Format/Format.svelte';
    import FormatGroup from '$lib/components/Editor/Format/FormatGroup.svelte';
    import FormatRedo from '$lib/components/Editor/Format/FormatRedo.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Format/FormatRedo',
        component: FormatRedo,
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
                        'Redo button, sitting beside Undo at the head of the toolbar. A one-shot action, so it never holds a pressed state. Disabled until something has been undone. Shown without a live editor, so clicks are no-ops.'
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
            name: m.content_format_redo()
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
                    <FormatRedo {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>

<Story
    name="Nothing to redo"
    args={{ disabled: true, editor: undefined }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_format_redo() })
        ).toBeDisabled();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup>
                    <FormatRedo {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>
