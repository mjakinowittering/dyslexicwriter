<script lang="ts" module>
    import { makeEditor } from '../../support/editor';
    import { FAKE_VOICES, makeTts } from '../../support/fakes.svelte';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn } from 'storybook/test';

    import ToolbarTts from '$lib/components/ContentEditor/Toolbar/ToolbarTts.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'ContentEditor/Toolbar/ToolbarTts',
        component: ToolbarTts,
        tags: ['autodocs'],
        argTypes: {
            editor: { control: false },
            persist: { control: false },
            controller: { control: false },
            disabled: { control: 'boolean' }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Read-aloud toolbar cluster — a fully-controlled `ToggleGroup` composing skip-back, stop, play/pause, skip-forward and voice settings. Its pressed state is derived from the TTS controller, never from the group itself, which is why the group’s setter is a no-op. The controller is handed to all five children.'
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

    const editor = makeEditor();
    $effect(() => () => editor.destroy());
</script>

<!-- At rest: only Play is reachable — there is no session to stop or skip within. -->
<Story
    name="Default"
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_tts_play() })
        ).toBeEnabled();

        for (const name of [
            m.content_tts_stop(),
            m.content_tts_skip_back(),
            m.content_tts_skip_forward()
        ]) {
            await expect(canvas.getByRole('button', { name })).toBeDisabled();
        }
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
