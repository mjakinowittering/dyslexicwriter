<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import StatusbarWordCount from '$lib/components/Editor/Statusbar/StatusbarWordCount.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Statusbar/StatusbarWordCount',
        component: StatusbarWordCount,
        tags: ['autodocs'],
        argTypes: {
            wordCount: { control: { type: 'number', min: 0 } }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Live word-count readout for the editor status bar, with a sigma icon. Renders nothing when the count is zero.'
                }
            }
        }
    });
</script>

<Story
    name="Default"
    args={{ wordCount: 128 }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByText(m.content_word_count({ count: '128' }))
        ).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <StatusbarWordCount {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Large Count"
    args={{ wordCount: 12500 }}
    play={async ({ canvas }) => {
        // Counts are localised, so a long document reads as 12,500 rather than 12500.
        await expect(
            canvas.getByText(m.content_word_count({ count: '12,500' }))
        ).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <StatusbarWordCount {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Zero (Hidden)"
    args={{ wordCount: 0 }}
    play={async ({ canvas }) => {
        // An empty document says nothing rather than "Words 0".
        await expect(
            canvas.queryByText(m.content_word_count({ count: '0' }))
        ).not.toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <StatusbarWordCount {...args} />
        </div>
    {/snippet}
</Story>
