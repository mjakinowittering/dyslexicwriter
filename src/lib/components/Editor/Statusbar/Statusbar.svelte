<script lang="ts">
    import * as m from '$lib/paraglide/messages';
    import type { SaveState } from '$lib/stores/document.svelte';

    import TimeToRead from './StatusbarTimeToRead.svelte';
    import WordCount from './StatusbarWordCount.svelte';

    // Always-visible bar along the bottom of the content column. It spans that
    // column only — when the settings panel is open it does not run underneath it.
    let {
        wordCount,
        saveState = 'idle',
        error = ''
    }: {
        wordCount: number;
        saveState?: SaveState;
        error?: string;
    } = $props();
</script>

<footer
    class="border-border text-muted-foreground flex h-9 shrink-0 items-center gap-4 border-t px-4 text-sm"
>
    <WordCount {wordCount} />
    <TimeToRead {wordCount} />

    <div class="ml-auto">
        {#if error}
            <!-- A failed write is the one thing here that must never be quiet. -->
            <span class="text-destructive">{error}</span>
        {:else if saveState === 'saving'}
            <span>{m.editor_saving()}</span>
        {:else if saveState === 'saved'}
            <span>{m.editor_saved()}</span>
        {/if}
    </div>
</footer>
