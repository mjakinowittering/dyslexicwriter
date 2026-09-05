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
                        'What is happening to the disk right now — writing it has not seen yet, or a write actually in flight, in one row that swaps glyph and words rather than moving them. Up for most of an active writing session, since autosave waits for a pause — a step darker than the rest of the bar so it registers, but never `destructive`, because pending is the normal state of a document being written. Its sibling reports how old the disk copy is and takes no save state at all.'
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
    name="Saving"
    args={{ saveState: 'saving' }}
    play={async ({ canvas }) => {
        // A write in flight swaps the record dot for a broken circle turning on
        // Tailwind's `animate-spin`. The words stay — a bare spinner would be
        // silent to a screen reader, and would say nothing under reduced motion.
        await expect(canvas.getByText(m.editor_saving())).toBeInTheDocument();
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
        // Only `pending` and `saving` have anything to report. Every other state
        // leaves this chip silent rather than claiming the disk is behind.
        await expect(
            canvas.queryByText(m.editor_unsaved())
        ).not.toBeInTheDocument();
        await expect(
            canvas.queryByText(m.editor_saving())
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
