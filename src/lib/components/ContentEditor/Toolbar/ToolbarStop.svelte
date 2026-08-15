<script lang="ts">
    import { StopIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as Tooltip from '$lib/components/Tooltip';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';

    import * as m from '$lib/paraglide/messages';
    import { speech } from '$lib/tts/speech-controller.svelte';
    import type { TtsTransport } from '$lib/tts/speech-controller.svelte';

    // A momentary action, not a toggle — "stop" is never in the group's pressed
    // array, so the item never lights (same trick as Format's horizontal rule).
    // `pause()` leaves isPlaying true, so this stays enabled while paused — which
    // is the whole point: it's the only way out of a paused read.
    //
    // `controller` defaults to the app's one controller — it is a prop only so a
    // story or a test can drive the button from a chosen playback state.
    let { controller = speech }: { controller?: TtsTransport } = $props();
</script>

<Tooltip.Provider>
    <Tooltip.Root>
        <Tooltip.Trigger>
            {#snippet child({ props })}
                <ToggleGroup.Item
                    {...props}
                    aria-label={m.content_tts_stop()}
                    disabled={!controller.isPlaying}
                    onclick={() => controller.stop()}
                    value="stop"
                >
                    <Icon icon={StopIcon} />
                </ToggleGroup.Item>
            {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom">
            <p>{m.content_tts_stop_hint()}</p>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>
