<script lang="ts">
    import { Summation01Icon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';

    let { wordCount }: { wordCount: number } = $props();
</script>

{#if wordCount > 0}
    <div class="flex flex-row items-center space-x-2">
        <Icon class="size-4" icon={Summation01Icon} />
        <small class="text-sm">
            {m.content_word_count({ count: wordCount.toLocaleString() })}
        </small>
    </div>
{/if}
