<script lang="ts">
    import { ModeWatcher } from 'mode-watcher';
    import type { Snippet } from 'svelte';

    import './layout.css';

    import favicon from '$lib/assets/favicon.svg';

    let { children }: { children: Snippet } = $props();

    // The theme is applied imperatively by the workspace store when a folder is
    // adopted and when the setting changes — see `workspace.applyTheme()`. Doing
    // it from an $effect here loops against mode-watcher, which writes to the
    // same <html> element. The font preference never reaches <html>: it dresses
    // the document surface alone.
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

<ModeWatcher />

<div class="flex h-full flex-col">
    {@render children()}
</div>
