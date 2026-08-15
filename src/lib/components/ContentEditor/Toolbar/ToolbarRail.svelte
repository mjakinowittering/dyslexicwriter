<script lang="ts">
    import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as Tooltip from '$lib/components/Tooltip';
    import Button from '$lib/components/ui/button/button.svelte';

    import * as m from '$lib/paraglide/messages';

    // The tall rail on the far left of the editor, spanning the full height of
    // the title row AND the toolbar row. Just a chevron — the app's logo sits in
    // its own column (`ToolbarLogo`) immediately to the right, and nothing else
    // here competes with the writing.
    let {
        disabled = false,
        onBack
    }: { disabled?: boolean; onBack: () => void } = $props();
</script>

<div
    class="border-border flex shrink-0 items-center justify-center border-r px-3"
>
    <Tooltip.Provider>
        <Tooltip.Root>
            <Tooltip.Trigger>
                {#snippet child({ props })}
                    <Button
                        {...props}
                        aria-label={m.editor_back()}
                        class="size-9"
                        {disabled}
                        onclick={onBack}
                        size="icon"
                        variant="ghost"
                    >
                        <Icon class="size-5" icon={ArrowLeft01Icon} />
                    </Button>
                {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content side="right">
                <p>{m.editor_back()}</p>
            </Tooltip.Content>
        </Tooltip.Root>
    </Tooltip.Provider>
</div>
