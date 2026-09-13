<script lang="ts">
    import { cn } from '$lib/utils';

    // The front of the welcome screen: what this app is, in one heading and one
    // sentence, before the cards ask for a folder.
    //
    // Our own markup rather than the Empty parts it replaced. Empty is sized for
    // "nothing here yet" — a small title under an icon tile — and this is the
    // first thing a stranger reads. No icon: both cards below carry one, and a
    // third above them would only repeat the folder.
    //
    // A real <h1>, because it is the page's heading. Empty.Title renders a <div>.
    let {
        title,
        description,
        class: className
    }: {
        title: string;
        description: string;
        class?: string;
    } = $props();
</script>

<div
    class={cn(
        'flex flex-col items-center gap-6 py-24 text-center lg:py-32',
        className
    )}
>
    <h1 class="text-4xl font-semibold tracking-tight text-balance lg:text-5xl">
        {title}
    </h1>
    <p class="text-muted-foreground max-w-2xl text-lg text-balance">
        {description}
    </p>
</div>
