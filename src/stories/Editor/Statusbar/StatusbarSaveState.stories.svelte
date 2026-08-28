<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import StatusbarSaveState from '$lib/components/Editor/Statusbar/StatusbarSaveState.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Statusbar/StatusbarSaveState',
        component: StatusbarSaveState,
        tags: ['autodocs'],
        argTypes: {
            saveState: {
                control: 'select',
                options: ['idle', 'pending', 'saving', 'saved']
            },
            savedAt: { control: { type: 'number' } }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'How old the copy on disk is — an age and nothing else, so it can sit beside "Unsaved changes" without contradicting it. Under a minute it says "Saved just now" rather than a figure that moves every tick. Renders nothing for a document that has never been written.'
                }
            }
        }
    });
</script>

<Story
    name="Saving"
    args={{ saveState: 'saving' }}
    play={async ({ canvas }) => {
        // A write in flight wins over any age: the chip reports the save that is
        // happening now, not the one before it.
        await expect(canvas.getByText(m.editor_saving())).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <StatusbarSaveState {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Saved Just Now"
    args={{ saveState: 'saved', savedAt: Date.now() }}
    play={async ({ canvas }) => {
        // Inside FRESH_MS, so fixed wording instead of a seconds count that
        // would fidget on every tick.
        await expect(
            canvas.getByText(m.editor_saved_recent())
        ).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <StatusbarSaveState {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Saved A While Ago"
    args={{
        saveState: 'saved',
        // Hours rather than minutes: `savedAt` is fixed when this module loads, so
        // a minutes-scale offset can round up mid-run and fail on a slow suite.
        savedAt: Date.now() - 2 * 60 * 60 * 1000
    }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByText(m.editor_saved_when({ when: '2 hours ago' }))
        ).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <StatusbarSaveState {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Never Saved (Hidden)"
    args={{ saveState: 'idle', savedAt: null }}
    play={async ({ canvas }) => {
        // A brand-new document has no age to report, so the chip stays out of the
        // way entirely rather than claiming a save that never happened.
        await expect(
            canvas.queryByText(m.editor_saved_recent())
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
            <StatusbarSaveState {...args} />
        </div>
    {/snippet}
</Story>
