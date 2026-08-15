<script lang="ts" module>
    import { makeEditor } from '../../support/editor';
    import { makeTts } from '../../support/fakes.svelte';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, screen, userEvent } from 'storybook/test';

    import ToolbarPlay from '$lib/components/ContentEditor/Toolbar/ToolbarPlay.svelte';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'ContentEditor/Toolbar/ToolbarPlay',
        component: ToolbarPlay,
        tags: ['autodocs'],
        argTypes: {
            editor: { control: false },
            controller: { control: false },
            disabled: { control: 'boolean' }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Read-aloud play/pause toggle. Reads playback state from the TTS controller and shows Play or Pause accordingly; disabled without a live editor. Wrapped in a `ToggleGroup.Root`, as in the TTS toolbar. `controller` defaults to the app’s controller — these stories pass a stand-in so every playback state can be shown.'
                }
            }
        }
    });
</script>

<script lang="ts">
    const idle = makeTts();
    const playing = makeTts({ isPlaying: true });
    const paused = makeTts({ isPlaying: true, isPaused: true });

    // The button gates itself on a live editor, so there has to be one.
    const editor = makeEditor();
    $effect(() => () => editor.destroy());
</script>

<Story
    name="Default"
    play={async ({ canvas }) => {
        const button = canvas.getByRole('button', {
            name: m.content_tts_play()
        });
        await expect(button).toBeEnabled();

        // The balloon names the action the button would take next.
        await userEvent.hover(button);
        await expect(
            await screen.findByText(m.content_tts_play_hint())
        ).toBeInTheDocument();

        await userEvent.click(button);
        await expect(idle.toggle).toHaveBeenCalledOnce();
        // The selection is captured on pointer-down, before the click moves focus.
        await expect(idle.captureSelection).toHaveBeenCalled();
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToggleGroup.Root type="multiple" variant="outline">
                <ToolbarPlay controller={idle} disabled={false} {editor} />
            </ToggleGroup.Root>
        </div>
    {/snippet}
</Story>

<!-- Mid-read: the same control now offers Pause. -->
<Story
    name="Playing"
    play={async ({ canvas }) => {
        await userEvent.hover(
            canvas.getByRole('button', { name: m.content_tts_play() })
        );
        await expect(
            await screen.findByText(m.content_tts_pause_hint())
        ).toBeInTheDocument();
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToggleGroup.Root type="multiple" variant="outline">
                <ToolbarPlay controller={playing} disabled={false} {editor} />
            </ToggleGroup.Root>
        </div>
    {/snippet}
</Story>

<!-- Paused counts as "resume", so it offers Play again rather than Pause. -->
<Story
    name="Paused"
    play={async ({ canvas }) => {
        await userEvent.hover(
            canvas.getByRole('button', { name: m.content_tts_play() })
        );
        await expect(
            await screen.findByText(m.content_tts_play_hint())
        ).toBeInTheDocument();
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToggleGroup.Root type="multiple" variant="outline">
                <ToolbarPlay controller={paused} disabled={false} {editor} />
            </ToggleGroup.Root>
        </div>
    {/snippet}
</Story>

<!-- Nothing to read: no live editor, so the control is out of reach. -->
<Story
    name="Disabled"
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_tts_play() })
        ).toBeDisabled();
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToggleGroup.Root type="multiple" variant="outline">
                <ToolbarPlay
                    controller={idle}
                    disabled={true}
                    editor={undefined}
                />
            </ToggleGroup.Root>
        </div>
    {/snippet}
</Story>
