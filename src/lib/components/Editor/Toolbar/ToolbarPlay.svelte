<script lang="ts">
    import { PauseIcon, PlayIcon } from '@hugeicons/core-free-icons';
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';
    import * as Tooltip from '$lib/components/ui/tooltip';

    import * as m from '$lib/paraglide/messages';
    import { speech } from '$lib/tts/speech-controller.svelte';
    import type { TtsTransport } from '$lib/tts/speech-controller.svelte';

    // `controller` defaults to the app's one controller — it is a prop only so a
    // story or a test can drive the button from a chosen playback state.
    let {
        editor,
        disabled = false,
        controller = speech
    }: {
        editor: Editor | undefined;
        disabled?: boolean;
        controller?: TtsTransport;
    } = $props();

    // Actively speaking (paused counts as "resume", so it shows Play).
    const playing = $derived(controller.isPlaying && !controller.isPaused);
</script>

<Tooltip.Provider>
    <Tooltip.Root>
        <Tooltip.Trigger>
            {#snippet child({ props })}
                <ToggleGroup.Item
                    {...props}
                    aria-label={m.content_tts_play()}
                    disabled={disabled || !editor}
                    onpointerdown={() => controller.captureSelection(editor)}
                    onclick={() => controller.toggle(editor)}
                    value="play"
                >
                    {#if playing}
                        <Icon icon={PauseIcon} />
                    {:else}
                        <Icon icon={PlayIcon} />
                    {/if}
                </ToggleGroup.Item>
            {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom">
            <p>
                {playing
                    ? m.content_tts_pause_hint()
                    : m.content_tts_play_hint()}
            </p>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>
