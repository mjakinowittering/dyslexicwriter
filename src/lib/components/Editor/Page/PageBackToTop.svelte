<script lang="ts">
    import { ArrowUp01Icon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Tooltip from '$lib/components/ui/tooltip';

    import * as m from '$lib/paraglide/messages';

    // Offered while read-aloud has the page following the voice down a long
    // document — the way back to where the writing starts. Whether it is shown at
    // all is the canvas's decision (see Page.svelte); this is only the control.
    let { onclick }: { onclick?: () => void } = $props();
</script>

<Tooltip.Provider>
    <Tooltip.Root>
        <Tooltip.Trigger>
            {#snippet child({ props })}
                <Button
                    {...props}
                    aria-label={m.content_tts_back_to_top()}
                    class="flex size-14 cursor-pointer items-center justify-center rounded-full shadow-md"
                    {onclick}
                    variant="secondary"
                >
                    <Icon icon={ArrowUp01Icon} class="size-8" />
                </Button>
            {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="left">
            <p>{m.content_tts_back_to_top_hint()}</p>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>
