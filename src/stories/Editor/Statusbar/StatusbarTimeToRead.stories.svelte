<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import StatusbarTimeToRead from '$lib/components/Editor/Statusbar/StatusbarTimeToRead.svelte';

    import * as m from '$lib/paraglide/messages';
    import calculateReadingTime from '$lib/utils/calculateReadingTime';

    const { Story } = defineMeta({
        title: 'Editor/Statusbar/StatusbarTimeToRead',
        component: StatusbarTimeToRead,
        tags: ['autodocs'],
        argTypes: {
            wordCount: { control: { type: 'number', min: 0 } },
            class: { control: 'text' }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Estimated-reading-time chip derived from a `wordCount` (the common denominator across the meta row and the editor status bar). Renders nothing for an empty document.'
                }
            }
        }
    });
</script>

<Story
    name="Short"
    args={{ wordCount: 120 }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByText(
                m.content_read_time({
                    time: calculateReadingTime(120).display
                })
            )
        ).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <StatusbarTimeToRead {...args} />
        </div>
    {/snippet}
</Story>

<Story name="Long Read" args={{ wordCount: 3200 }}>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <StatusbarTimeToRead {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Empty (Hidden)"
    args={{ wordCount: 0 }}
    play={async ({ canvas }) => {
        // Nothing written yet, so there is no reading time to claim.
        await expect(
            canvas.queryByText(
                m.content_read_time({ time: calculateReadingTime(1).display })
            )
        ).not.toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <StatusbarTimeToRead {...args} />
        </div>
    {/snippet}
</Story>
