<script lang="ts">
    import { VolumeHighIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import { Toggle } from '$lib/components/ui/toggle';
    import * as Tooltip from '$lib/components/ui/tooltip';

    import * as m from '$lib/paraglide/messages';

    // The toolbar's one read-aloud control: it opens the floating bar that
    // holds the transport, and is pressed while that bar is open. Opening it
    // starts no read — the writer presses Play in the bar. Pressing it again
    // puts the bar away and ends any read, as Stop does.
    let {
        ref = $bindable(null),
        open,
        disabled = false,
        onOpenChange
    }: {
        // The button, so the page can hand focus back here when Stop takes the
        // bar — and the focused button with it — away.
        ref?: HTMLElement | null;
        open: boolean;
        disabled?: boolean;
        onOpenChange: (open: boolean) => void;
    } = $props();
</script>

<Tooltip.Provider>
    <Tooltip.Root>
        <Tooltip.Trigger>
            {#snippet child({ props })}
                <Toggle
                    {...props}
                    bind:ref
                    aria-label={m.content_tts_open()}
                    {disabled}
                    onPressedChange={onOpenChange}
                    pressed={open}
                    variant="outline"
                >
                    <Icon icon={VolumeHighIcon} />
                </Toggle>
            {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom">
            <span>{m.content_tts_open_hint()}</span>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>
