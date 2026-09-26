<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, userEvent } from 'storybook/test';

    import ToolbarReadAloud from '$lib/components/Editor/Toolbar/ToolbarReadAloud.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Toolbar/ToolbarReadAloud',
        component: ToolbarReadAloud,
        tags: ['autodocs'],
        argTypes: {
            ref: { control: false },
            onOpenChange: { control: false },
            open: { control: 'boolean' },
            disabled: { control: 'boolean' }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The toolbar’s one read-aloud control. It opens the floating read-aloud bar over the canvas and is pressed while that bar is open; opening starts no read, the writer presses Play in the bar. Pressing it again closes the bar and ends any read.'
                }
            }
        }
    });
</script>

<Story
    name="Closed"
    args={{ open: false, disabled: false, onOpenChange: fn() }}
    play={async ({ args, canvas }) => {
        const button = canvas.getByRole('button', {
            name: m.content_tts_open()
        });
        await expect(button).toHaveAttribute('aria-pressed', 'false');
        await userEvent.click(button);
        await expect(args.onOpenChange).toHaveBeenCalledWith(true);
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToolbarReadAloud {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Open"
    args={{ open: true, disabled: false, onOpenChange: fn() }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_tts_open() })
        ).toHaveAttribute('aria-pressed', 'true');
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToolbarReadAloud {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Disabled"
    args={{ open: false, disabled: true, onOpenChange: fn() }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_tts_open() })
        ).toBeDisabled();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToolbarReadAloud {...args} />
        </div>
    {/snippet}
</Story>
