<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import StatusbarUnsaved from '$lib/components/Editor/Statusbar/StatusbarUnsaved.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Statusbar/StatusbarUnsaved',
        component: StatusbarUnsaved,
        tags: ['autodocs'],
        argTypes: {
            saveState: {
                control: 'select',
                options: ['idle', 'pending', 'saving', 'saved']
            }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        '"There is writing here the disk has not seen." Up for most of an active writing session, since autosave waits for a pause — a step darker than the rest of the bar so it registers, but never `destructive`, because pending is the normal state of a document being written. Its sibling says how old the disk copy is; this one only says whether that copy is behind.'
                }
            }
        }
    });
</script>

<Story
    name="Pending"
    args={{ saveState: 'pending' }}
    play={async ({ canvas }) => {
        await expect(canvas.getByText(m.editor_unsaved())).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <StatusbarUnsaved {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Idle (Hidden)"
    args={{ saveState: 'idle' }}
    play={async ({ canvas }) => {
        // Only `pending` means the disk is behind. Every other state — including a
        // write in flight — leaves this chip silent.
        await expect(
            canvas.queryByText(m.editor_unsaved())
        ).not.toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <StatusbarUnsaved {...args} />
        </div>
    {/snippet}
</Story>
