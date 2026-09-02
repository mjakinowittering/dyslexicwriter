<script lang="ts">
    import { PreviousIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';
    import * as Tooltip from '$lib/components/ui/tooltip';

    import * as m from '$lib/paraglide/messages';
    import { speech } from '$lib/tts/speech-controller.svelte';
    import type { TtsTransport } from '$lib/tts/speech-controller.svelte';

    // A momentary action, not a toggle — "skip-back" is never in the group's pressed
    // array, so the item never lights (same trick as Stop). Media-player convention:
    // restart the current sentence, or step back one when playback has only just
    // entered it. Enabled for the whole session, including while paused.
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
                    aria-label={m.content_tts_skip_back()}
                    disabled={!controller.canSkipBack}
                    onclick={() => controller.skipBack()}
                    value="skip-back"
                >
                    <Icon icon={PreviousIcon} />
                </ToggleGroup.Item>
            {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom">
            <p>{m.content_tts_skip_back_hint()}</p>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>
