<script lang="ts">
    import type { Editor } from '@tiptap/core';

    import * as ToggleGroup from '$lib/components/ui/toggle-group';

    import type { TtsPreferences } from '$lib/models/tts.model';
    import { speech } from '$lib/tts/speech-controller.svelte';
    import type { TtsTransport } from '$lib/tts/speech-controller.svelte';

    import Play from './ToolbarPlay.svelte';
    import SkipBack from './ToolbarSkipBack.svelte';
    import SkipForward from './ToolbarSkipForward.svelte';
    import Stop from './ToolbarStop.svelte';
    import VoiceSettings from './ToolbarVoiceSettings.svelte';

    let {
        editor,
        persist,
        disabled = false,
        controller = speech
    }: {
        editor: Editor | undefined;
        persist: (prefs: TtsPreferences) => void;
        // Disables Play only (there's nothing to read) — Stop/Voice stay usable, and
        // the skip buttons gate themselves on the live playback session.
        disabled?: boolean;
        // Defaults to the app's one controller, and is handed to all five children
        // so the whole transport can be driven from a chosen state in a story.
        controller?: TtsTransport;
    } = $props();

    let settingsOpen = $state(false);

    // Actively speaking (paused counts as "resume", so it reads as un-pressed).
    const playing = $derived(controller.isPlaying && !controller.isPaused);

    // The pressed state is derived from the real sources of truth, never from the
    // group itself — hence the no-op setter below (a fully controlled ToggleGroup).
    const pressed = $derived([
        ...(playing ? ['play'] : []),
        ...(settingsOpen ? ['voice'] : [])
    ]);
</script>

<ToggleGroup.Root
    type="multiple"
    variant="outline"
    bind:value={() => pressed, () => {}}
>
    <SkipBack {controller} />
    <Stop {controller} />
    <Play {controller} {editor} {disabled} />
    <SkipForward {controller} />
    <VoiceSettings {controller} {persist} bind:open={settingsOpen} />
</ToggleGroup.Root>
