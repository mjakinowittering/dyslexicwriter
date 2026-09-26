<script lang="ts" module>
    import { makeEditor } from '../../support/editor';
    import { FAKE_VOICES, makeTts } from '../../support/fakes.svelte';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, userEvent } from 'storybook/test';

    import ToolbarTts from '$lib/components/Editor/Toolbar/ToolbarTts.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Toolbar/ToolbarTts',
        component: ToolbarTts,
        tags: ['autodocs'],
        argTypes: {
            editor: { control: false },
            persist: { control: false },
            controller: { control: false },
            onClose: { control: false },
            autofocus: { control: false },
            disabled: { control: 'boolean' }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The read-aloud bar — a fully-controlled `ToggleGroup` composing skip-back, stop, play/pause, skip-forward and voice settings, on its own floating surface. The editor pins it to the canvas’s top-right corner while the toolbar’s Read aloud button holds it open. Its pressed state is derived from the TTS controller, never from the group itself, which is why the group’s setter is a no-op. With `onClose`, Stop also puts the bar away, so it stays live even before anything has been read. The controller is handed to all five children.'
                }
            }
        }
    });
</script>

<script lang="ts">
    const idle = makeTts({ voices: FAKE_VOICES });
    const reading = makeTts({
        isPlaying: true,
        canSkipBack: true,
        canSkipForward: true,
        voices: FAKE_VOICES
    });

    const close = fn();

    const editor = makeEditor();
    $effect(() => () => editor.destroy());
</script>

<!-- Just opened: nothing read yet. Play is live, and Stop too — it puts the bar
     away. The skips have no session to move within. -->
<Story
    name="Default"
    play={async ({ canvas }) => {
        for (const name of [m.content_tts_play(), m.content_tts_stop()]) {
            await expect(canvas.getByRole('button', { name })).toBeEnabled();
        }
        for (const name of [
            m.content_tts_skip_back(),
            m.content_tts_skip_forward()
        ]) {
            await expect(canvas.getByRole('button', { name })).toBeDisabled();
        }

        await userEvent.click(
            canvas.getByRole('button', { name: m.content_tts_stop() })
        );
        await expect(close).toHaveBeenCalledOnce();
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToolbarTts
                controller={idle}
                disabled={false}
                {editor}
                onClose={close}
                persist={fn()}
            />
        </div>
    {/snippet}
</Story>

<!-- Mid-read: the whole transport is live, and Play lights as the pressed member
     of the group. -->
<Story
    name="Playing"
    play={async ({ canvas }) => {
        for (const name of [
            m.content_tts_play(),
            m.content_tts_stop(),
            m.content_tts_skip_back(),
            m.content_tts_skip_forward()
        ]) {
            await expect(canvas.getByRole('button', { name })).toBeEnabled();
        }

        await expect(
            canvas.getByRole('button', { name: m.content_tts_play() })
        ).toHaveAttribute('data-state', 'on');
        // Stop is momentary: live, but never pressed.
        await expect(
            canvas.getByRole('button', { name: m.content_tts_stop() })
        ).toHaveAttribute('data-state', 'off');
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToolbarTts
                controller={reading}
                disabled={false}
                {editor}
                onClose={fn()}
                persist={fn()}
            />
        </div>
    {/snippet}
</Story>

<!-- Nothing to read: Play goes, but the voice settings stay reachable. -->
<Story
    name="No Document"
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_tts_play() })
        ).toBeDisabled();
        await expect(
            canvas.getByRole('button', { name: m.content_tts_settings() })
        ).toBeEnabled();
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToolbarTts
                controller={idle}
                disabled={true}
                editor={undefined}
                persist={fn()}
            />
        </div>
    {/snippet}
</Story>
