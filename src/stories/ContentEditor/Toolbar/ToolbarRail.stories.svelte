<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, userEvent } from 'storybook/test';

    import ToolbarRail from '$lib/components/ContentEditor/Toolbar/ToolbarRail.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'ContentEditor/Toolbar/ToolbarRail',
        component: ToolbarRail,
        tags: ['autodocs'],
        argTypes: {
            disabled: { control: 'boolean' },
            onBack: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The tall rail on the far left of the editor, spanning the title row and the toolbar row. One control only — the back chevron, which flushes the document and returns to the Files screen.'
                }
            }
        }
    });
</script>

<Story
    name="Default"
    args={{ disabled: false, onBack: fn() }}
    play={async ({ args, canvas }) => {
        await userEvent.click(
            canvas.getByRole('button', { name: m.editor_back() })
        );
        await expect(args.onBack).toHaveBeenCalledOnce();
    }}
>
    {#snippet template(args)}
        <div class="bg-background flex h-40 w-full">
            <ToolbarRail {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Disabled"
    args={{ disabled: true, onBack: fn() }}
    play={async ({ args, canvas }) => {
        const back = canvas.getByRole('button', { name: m.editor_back() });
        await expect(back).toBeDisabled();
        await expect(args.onBack).not.toHaveBeenCalled();
    }}
>
    {#snippet template(args)}
        <div class="bg-background flex h-40 w-full">
            <ToolbarRail {...args} />
        </div>
    {/snippet}
</Story>
