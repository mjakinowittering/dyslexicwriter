<script lang="ts">
    import { Settings01Icon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Tooltip from '$lib/components/ui/tooltip';

    import * as m from '$lib/paraglide/messages';

    let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<Tooltip.Provider>
    <Tooltip.Root>
        <Tooltip.Trigger>
            {#snippet child({ props })}
                <Button
                    {...props}
                    aria-expanded={open}
                    aria-label={m.settings_title()}
                    onclick={() => (open = !open)}
                    size="icon"
                    variant="ghost"
                >
                    <Icon icon={Settings01Icon} />
                </Button>
            {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom">
            <p>{m.settings_title()}</p>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>
