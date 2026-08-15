<script lang="ts" module>
    import { makeTts } from '../../support/fakes.svelte';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, userEvent } from 'storybook/test';

    import ToolbarSkipForward from '$lib/components/ContentEditor/Toolbar/ToolbarSkipForward.svelte';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'ContentEditor/Toolbar/ToolbarSkipForward',
        component: ToolbarSkipForward,
        tags: ['autodocs'],
        argTypes: {
            controller: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Skip-forward control for read-aloud. A momentary action, not a toggle. Disabled on the last sentence, so skipping can never quietly end the read.'
                }
            }
        }
    });
</script>

<script lang="ts">
    const idle = makeTts();
    const reading = makeTts({ isPlaying: true, canSkipForward: true });
</script>

<!-- On the last sentence (or not reading at all) there is nowhere to skip to. -->
<Story
    name="Default"
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_tts_skip_forward() })
        ).toBeDisabled();
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToggleGroup.Root type="multiple" variant="outline">
                <ToolbarSkipForward controller={idle} />
            </ToggleGroup.Root>
        </div>
    {/snippet}
</Story>

<!-- Mid-read with a sentence still to come. -->
<Story
    name="Available"
    play={async ({ canvas }) => {
        const button = canvas.getByRole('button', {
            name: m.content_tts_skip_forward()
        });
        // Momentary, never pressed: in the real cluster the group is fully
        // controlled from the controller, so skipping is never in its pressed array.
        await expect(button).toHaveAttribute('data-state', 'off');

        await userEvent.click(button);
        await expect(reading.skipForward).toHaveBeenCalledOnce();
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToggleGroup.Root type="multiple" variant="outline">
                <ToolbarSkipForward controller={reading} />
            </ToggleGroup.Root>
        </div>
    {/snippet}
</Story>
