<script lang="ts">
    import { EyeIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';
    import { cn } from '$lib/utils';
    import calculateReadingTime from '$lib/utils/calculateReadingTime';

    // The estimated-reading-time chip. Takes a `wordCount` rather than a body
    // because that is the common denominator across its call sites: the content
    // meta row derives the count from the markdown `body`, while the editor's
    // status bar has a live count from TipTap's CharacterCount and no body at all.
    // Renders nothing for an empty document.
    let {
        wordCount,
        class: className
    }: {
        wordCount: number;
        class?: string;
    } = $props();
</script>

{#if wordCount > 0}
    <div class={cn('flex items-center gap-2', className)}>
        <Icon class="size-4" icon={EyeIcon} />
        <span class="text-sm">
            {m.content_read_time({
                time: calculateReadingTime(wordCount).display
            })}
        </span>
    </div>
{/if}
