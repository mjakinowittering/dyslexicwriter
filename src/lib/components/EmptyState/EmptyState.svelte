<script lang="ts">
    import type { IconSvgElement } from '@hugeicons/svelte';
    import type { Snippet } from 'svelte';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as Empty from '$lib/components/ui/empty';

    import { cn } from '$lib/utils';

    // Generic empty-state scaffold — an optional icon, a title, a description,
    // and an optional `action` snippet (e.g. a CTA button). The `action` is only
    // rendered when provided, so a read-only/no-CTA variant shows no empty
    // content block. The `icon` is optional too — omit it when a surrounding
    // header already carries the section's icon. Always centered.
    let {
        icon,
        title,
        description,
        action,
        class: className = 'h-full'
    }: {
        icon?: IconSvgElement;
        title: string;
        description: string;
        action?: Snippet;
        class?: string;
    } = $props();
</script>

<Empty.Root class={cn(className)}>
    <Empty.Header>
        {#if icon}
            <Empty.Media variant="icon">
                <Icon {icon} />
            </Empty.Media>
        {/if}
        <Empty.Title>{title}</Empty.Title>
        <Empty.Description>{description}</Empty.Description>
    </Empty.Header>
    {#if action}
        <Empty.Content>
            {@render action()}
        </Empty.Content>
    {/if}
</Empty.Root>
