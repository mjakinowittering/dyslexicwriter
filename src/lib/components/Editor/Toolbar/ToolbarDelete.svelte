<script lang="ts">
    import { Delete02Icon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Tooltip from '$lib/components/ui/tooltip';

    import * as m from '$lib/paraglide/messages';

    // Delete, in the editor header beside the settings gear — deliberately not in
    // the formatting toolbar, which is capped and acts on the text rather than on
    // the document. The same icon the Files tree's Delete uses. The button only
    // asks: the page owns the confirm and the move into the trash.
    let {
        disabled = false,
        onDelete
    }: { disabled?: boolean; onDelete: () => void } = $props();
</script>

<Tooltip.Provider>
    <Tooltip.Root>
        <Tooltip.Trigger>
            {#snippet child({ props })}
                <Button
                    {...props}
                    aria-label={m.files_delete()}
                    {disabled}
                    onclick={onDelete}
                    size="icon"
                    variant="ghost"
                >
                    <Icon icon={Delete02Icon} />
                </Button>
            {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom">
            <p>{m.files_delete()}</p>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>
