<script lang="ts">
    import { PauseIcon, PlayIcon } from '@hugeicons/core-free-icons';
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';
    import { speech } from '$lib/tts/speech-controller.svelte';
    import type { TtsTransport } from '$lib/tts/speech-controller.svelte';

    import ToolbarTransportButton from './ToolbarTransportButton.svelte';

    // The one transport control that is a real toggle: it reports itself pressed
    // while speech is running, and swaps to a pause glyph to say so.
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

<ToolbarTransportButton
    label={m.content_tts_play()}
    hint={playing ? m.content_tts_pause_hint() : m.content_tts_play_hint()}
    value="play"
    disabled={disabled || !editor}
    onClick={() => controller.toggle(editor)}
    onPointerDown={() => controller.captureSelection(editor)}
>
    {#if playing}
        <Icon icon={PauseIcon} />
    {:else}
        <Icon icon={PlayIcon} />
    {/if}
</ToolbarTransportButton>
