<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import Statusbar from '$lib/components/Editor/Statusbar/Statusbar.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Statusbar/Statusbar',
        component: Statusbar,
        tags: ['autodocs'],
        argTypes: {
            wordCount: { control: { type: 'number', min: 0 } },
            saveState: {
                control: 'select',
                options: ['idle', 'pending', 'saving', 'saved']
            },
            savedAt: { control: { type: 'number' } },
            error: { control: 'text' }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Always-visible bar along the bottom of the content column: word count and reading time on the left, and on the right two separate answers — whether the disk is behind (the unsaved chip) and how far behind (the recency chip). A save error replaces both and is the one thing here that is never quiet.'
                }
            }
        }
    });
</script>

<Story
    name="Idle"
    args={{ wordCount: 842, saveState: 'idle' }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByText(m.content_word_count({ count: '842' }))
        ).toBeInTheDocument();
        // Nothing to report while idle — no "Saving…", no "Saved".
        await expect(
            canvas.queryByText(m.editor_saving())
        ).not.toBeInTheDocument();
        await expect(
            canvas.queryByText(m.editor_saved_recent())
        ).not.toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div class="bg-background w-full">
            <Statusbar {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Saving"
    args={{
        wordCount: 842,
        saveState: 'saving',
        // Hours rather than minutes, for the same reason as "Saved A While Ago":
        // a minutes-scale offset can round up mid-run on a slow suite.
        savedAt: Date.now() - 2 * 60 * 60 * 1000
    }}
    play={async ({ canvas }) => {
        // Both chips at once, which is the whole point of keeping them apart:
        // the spinner reports the write in flight while the age goes on saying
        // how old the copy already on disk is, instead of blanking out.
        await expect(canvas.getByText(m.editor_saving())).toBeInTheDocument();
        await expect(
            canvas.getByText(m.editor_saved_when({ when: '2 hours ago' }))
        ).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div class="bg-background w-full">
            <Statusbar {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Saved"
    args={{ wordCount: 842, saveState: 'saved', savedAt: Date.now() }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByText(m.editor_saved_recent())
        ).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div class="bg-background w-full">
            <Statusbar {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Saved A While Ago"
    args={{
        wordCount: 842,
        saveState: 'saved',
        // Hours rather than minutes: `savedAt` is fixed when this module loads, so
        // a minutes-scale offset can round up mid-run and fail on a slow suite.
        savedAt: Date.now() - 2 * 60 * 60 * 1000
    }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByText(m.editor_saved_when({ when: '2 hours ago' }))
        ).toBeInTheDocument();
        // Nothing is pending, so the document is not flagged as behind.
        await expect(
            canvas.queryByText(m.editor_unsaved())
        ).not.toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div class="bg-background w-full">
            <Statusbar {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Unsaved"
    args={{
        wordCount: 842,
        saveState: 'pending',
        savedAt: Date.now() - 2 * 60 * 60 * 1000
    }}
    play={async ({ canvas }) => {
        // Both chips at once: the disk is behind, and by two hours.
        await expect(canvas.getByText(m.editor_unsaved())).toBeInTheDocument();
        await expect(
            canvas.getByText(m.editor_saved_when({ when: '2 hours ago' }))
        ).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div class="bg-background w-full">
            <Statusbar {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Unsaved, Never Saved"
    args={{ wordCount: 842, saveState: 'pending', savedAt: null }}
    play={async ({ canvas }) => {
        // The first thirty seconds of a brand-new document. There is no age to
        // report yet, so the unsaved chip carries the bar on its own — this is the
        // state that used to leave it completely blank.
        await expect(canvas.getByText(m.editor_unsaved())).toBeInTheDocument();
        await expect(
            canvas.queryByText(m.editor_saved_recent())
        ).not.toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div class="bg-background w-full">
            <Statusbar {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Save Error"
    args={{
        wordCount: 842,
        saveState: 'saved',
        savedAt: Date.now(),
        error: m.editor_save_error()
    }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByText(m.editor_save_error())
        ).toBeInTheDocument();
        // The error wins over the save state — a failed write must not read as "Saved".
        await expect(
            canvas.queryByText(m.editor_saved_recent())
        ).not.toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div class="bg-background w-full">
            <Statusbar {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Empty Document"
    args={{ wordCount: 0, saveState: 'idle' }}
    play={async ({ canvas }) => {
        // Word count and reading time both hide at zero, so a new document opens
        // to a bar with nothing to say.
        await expect(
            canvas.queryByText(m.content_word_count({ count: '0' }))
        ).not.toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div class="bg-background w-full">
            <Statusbar {...args} />
        </div>
    {/snippet}
</Story>
