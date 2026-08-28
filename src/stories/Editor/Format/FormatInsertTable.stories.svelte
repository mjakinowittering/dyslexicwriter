<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import Format from '$lib/components/Editor/Format/Format.svelte';
    import FormatGroup from '$lib/components/Editor/Format/FormatGroup.svelte';
    import FormatInsertTable from '$lib/components/Editor/Format/FormatInsertTable.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Format/FormatInsertTable',
        component: FormatInsertTable,
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
                        'Table insert button. Always inserts a 3×3 with a header row — the shape that survives the markdown round-trip, since GFM tables require a header. A one-shot action, so it never holds a pressed state. Shown without a live editor, so clicks are no-ops.'
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
            name: m.content_format_table()
        });
        await expect(button).toBeEnabled();
        // An insert action, never a toggle: no pressed state to report.
        await expect(button).not.toHaveAttribute('aria-pressed');
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup>
                    <FormatInsertTable {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>

<Story
    name="Disabled"
    args={{ disabled: true, editor: undefined }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_format_table() })
        ).toBeDisabled();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup>
                    <FormatInsertTable {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>
