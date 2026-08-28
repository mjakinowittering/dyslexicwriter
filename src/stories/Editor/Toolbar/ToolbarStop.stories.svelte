<script lang="ts" module>
    import { makeTts } from '../../support/fakes.svelte';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, userEvent } from 'storybook/test';

    import ToolbarStop from '$lib/components/Editor/Toolbar/ToolbarStop.svelte';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Toolbar/ToolbarStop',
        component: ToolbarStop,
        tags: ['autodocs'],
        argTypes: {
            controller: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Stop control for read-aloud. A momentary action, not a toggle — “stop” never enters the group’s pressed array, so the item never lights. Enabled only during a live read, and it stays enabled while paused, because it is the only way out of a paused read.'
                }
            }
        }
    });
</script>

<script lang="ts">
    const idle = makeTts();
    const playing = makeTts({ isPlaying: true });
    const paused = makeTts({ isPlaying: true, isPaused: true });
</script>

<!-- Nothing is being read, so there is nothing to stop. -->
<Story
    name="Default"
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_tts_stop() })
        ).toBeDisabled();
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToggleGroup.Root type="multiple" variant="outline">
                <ToolbarStop controller={idle} />
            </ToggleGroup.Root>
        </div>
    {/snippet}
</Story>

<Story
    name="Playing"
    play={async ({ canvas }) => {
        const button = canvas.getByRole('button', {
            name: m.content_tts_stop()
        });
        // Momentary, never pressed: in the real cluster the group is fully
        // controlled from the controller, so "stop" is never in its pressed array.
        await expect(button).toHaveAttribute('data-state', 'off');

        await userEvent.click(button);
        await expect(playing.stop).toHaveBeenCalledOnce();
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToggleGroup.Root type="multiple" variant="outline">
                <ToolbarStop controller={playing} />
            </ToggleGroup.Root>
        </div>
    {/snippet}
</Story>

<!-- Paused leaves the session alive, so Stop is still the way out of it. -->
<Story
    name="Paused"
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_tts_stop() })
        ).toBeEnabled();
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToggleGroup.Root type="multiple" variant="outline">
                <ToolbarStop controller={paused} />
            </ToggleGroup.Root>
        </div>
    {/snippet}
</Story>
