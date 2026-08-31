<script lang="ts">
    import type { IconSvgElement } from '@hugeicons/svelte';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import Button from '$lib/components/ui/button/button.svelte';

    import { cn } from '$lib/utils';

    // One of the large choices on the welcome screen: an icon, a short heading,
    // and a sentence saying where the writing will actually end up.
    //
    // It is a Button rather than a Card because the whole thing is the click
    // target and Card renders a <div> — a card-shaped div with a handler on it
    // would be a button the keyboard can't reach. The class overrides only undo
    // the default size and single-line layout.
    let {
        icon,
        title,
        description,
        onclick,
        class: className
    }: {
        icon: IconSvgElement;
        title: string;
        description: string;
        onclick: () => void;
        class?: string;
    } = $props();
</script>

<Button
    class={cn(
        'h-auto w-full flex-col items-start gap-2 p-5 text-left whitespace-normal hover:cursor-pointer',
        className
    )}
    {onclick}
    variant="outline"
>
    <Icon class="size-6" {icon} />
    <span class="text-base font-semibold">{title}</span>
    <span class="text-muted-foreground text-sm font-normal">
        {description}
    </span>
</Button>
