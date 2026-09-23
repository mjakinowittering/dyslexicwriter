<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, userEvent } from 'storybook/test';

    import ToolbarDelete from '$lib/components/Editor/Toolbar/ToolbarDelete.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Toolbar/ToolbarDelete',
        component: ToolbarDelete,
        tags: ['autodocs'],
        args: {
            onDelete: fn()
        },
        argTypes: {
            disabled: { control: 'boolean' }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The Delete button in the editor header. It only reports the click — the page confirms, then moves the document into `.trash/`. Disabled for a document that has never been saved, which has nothing on disk to move.'
                }
            }
        }
    });
</script>

<Story
    name="Default"
    play={async ({ args, canvas }) => {
        await userEvent.click(
            canvas.getByRole('button', { name: m.files_delete() })
        );
        await expect(args.onDelete).toHaveBeenCalledOnce();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToolbarDelete {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Disabled"
    args={{ disabled: true }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.files_delete() })
        ).toBeDisabled();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToolbarDelete {...args} />
        </div>
    {/snippet}
</Story>
