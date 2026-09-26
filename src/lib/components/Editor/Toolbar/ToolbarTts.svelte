<script lang="ts">
    import type { Editor } from '@tiptap/core';

    import * as ToggleGroup from '$lib/components/ui/toggle-group';
    import * as Tooltip from '$lib/components/ui/tooltip';

    import type { TtsPreferences } from '$lib/models/tts.model';
    import * as m from '$lib/paraglide/messages';
    import { speech } from '$lib/tts/speech-controller.svelte';
    import type { TtsTransport } from '$lib/tts/speech-controller.svelte';

    import Play from './ToolbarPlay.svelte';
    import SkipBack from './ToolbarSkipBack.svelte';
    import SkipForward from './ToolbarSkipForward.svelte';
    import Stop from './ToolbarStop.svelte';
    import VoiceSettings from './ToolbarVoiceSettings.svelte';

    // The read-aloud bar: the whole transport, floating over the canvas's
    // top-right corner (the page puts it there, through `Page`'s `controls`).
    // The toolbar only has the button that opens it — see `ToolbarReadAloud`.
    let {
        editor,
        persist,
        onClose,
        autofocus = false,
        disabled = false,
        controller = speech
    }: {
        editor: Editor | undefined;
        persist: (prefs: TtsPreferences) => void;
        // Stop's second job: it also puts the bar away, even before anything
        // has been read. Omitted, Stop is only a stop.
        onClose?: () => void;
        // Focus Play on mount, so the writer who opened the bar can press Enter
        // straight away. The page asks for it; a story does not.
        autofocus?: boolean;
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

    // Play is found by its name rather than handed a ref down two components:
    // the name is the one thing about it a writer relies on too.
    function focusPlay(node: HTMLElement) {
        if (!autofocus) return;
        node.querySelector<HTMLElement>(
            `[aria-label="${m.content_tts_play()}"]`
        )?.focus();
    }
</script>

<!-- One tooltip provider for the whole transport, the way `Format` provides one
     for the formatting row. Each button used to bring its own.

     The surface is the bar's own: a plain box on the theme's tokens, lifted off
     the canvas with the same shadow the back-to-top button uses. -->
<Tooltip.Provider>
    <div
        {@attach focusPlay}
        class="bg-background border-border rounded-lg border p-1 shadow-md"
        role="toolbar"
        aria-label={m.content_tts_bar_label()}
    >
        <ToggleGroup.Root
            type="multiple"
            variant="outline"
            bind:value={() => pressed, () => {}}
        >
            <SkipBack {controller} />
            <Stop {controller} onStop={onClose} />
            <Play {controller} {editor} {disabled} />
            <SkipForward {controller} />
            <VoiceSettings {controller} {persist} bind:open={settingsOpen} />
        </ToggleGroup.Root>
    </div>
</Tooltip.Provider>
