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
                options: ['idle', 'saving', 'saved']
            },
            error: { control: 'text' }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Always-visible bar along the bottom of the content column: word count, reading time, and the save state on the right. A save error replaces the state entirely and is the one thing here that is never quiet.'
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
            canvas.queryByText(m.editor_saved())
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
    args={{ wordCount: 842, saveState: 'saving' }}
    play={async ({ canvas }) => {
        await expect(canvas.getByText(m.editor_saving())).toBeInTheDocument();
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
    args={{ wordCount: 842, saveState: 'saved' }}
    play={async ({ canvas }) => {
        await expect(canvas.getByText(m.editor_saved())).toBeInTheDocument();
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
        error: m.editor_save_error()
    }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByText(m.editor_save_error())
        ).toBeInTheDocument();
        // The error wins over the save state — a failed write must not read as "Saved".
        await expect(
            canvas.queryByText(m.editor_saved())
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
