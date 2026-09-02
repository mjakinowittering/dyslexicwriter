<script lang="ts">
    import { NextIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';
    import * as Tooltip from '$lib/components/ui/tooltip';

    import * as m from '$lib/paraglide/messages';
    import { speech } from '$lib/tts/speech-controller.svelte';
    import type { TtsTransport } from '$lib/tts/speech-controller.svelte';

    // A momentary action, not a toggle — "skip-forward" is never in the group's
    // pressed array, so the item never lights (same trick as Stop). Disabled on the
    // last sentence, so skipping can't quietly end the read.
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
                    aria-label={m.content_tts_skip_forward()}
                    disabled={!controller.canSkipForward}
                    onclick={() => controller.skipForward()}
                    value="skip-forward"
                >
                    <Icon icon={NextIcon} />
                </ToggleGroup.Item>
            {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom">
            <p>{m.content_tts_skip_forward_hint()}</p>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>
