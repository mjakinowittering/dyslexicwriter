<script lang="ts" module>
    import { makeTts } from '../../support/fakes.svelte';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, userEvent } from 'storybook/test';

    import ToolbarSkipBack from '$lib/components/Editor/Toolbar/ToolbarSkipBack.svelte';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Toolbar/ToolbarSkipBack',
        component: ToolbarSkipBack,
        tags: ['autodocs'],
        argTypes: {
            controller: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Skip-back control for read-aloud. A momentary action, not a toggle. Media-player convention: restart the current sentence, or step back one when playback has only just entered it. Available for the whole session, including while paused — and never on the first sentence of a read that has not started.'
                }
            }
        }
    });
</script>

<script lang="ts">
    const idle = makeTts();
    const reading = makeTts({ isPlaying: true, canSkipBack: true });
</script>

<!-- No live read, so there is no sentence to go back to. -->
<Story
    name="Default"
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_tts_skip_back() })
        ).toBeDisabled();
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToggleGroup.Root type="multiple" variant="outline">
                <ToolbarSkipBack controller={idle} />
            </ToggleGroup.Root>
        </div>
    {/snippet}
</Story>

<!-- Mid-read: skipping back restarts the sentence being spoken. -->
<Story
    name="Available"
    play={async ({ canvas }) => {
        const button = canvas.getByRole('button', {
            name: m.content_tts_skip_back()
        });
        // Momentary, never pressed: in the real cluster the group is fully
        // controlled from the controller, so skipping is never in its pressed array.
        await expect(button).toHaveAttribute('data-state', 'off');

        await userEvent.click(button);
        await expect(reading.skipBack).toHaveBeenCalledOnce();
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToggleGroup.Root type="multiple" variant="outline">
                <ToolbarSkipBack controller={reading} />
            </ToggleGroup.Root>
        </div>
    {/snippet}
</Story>
