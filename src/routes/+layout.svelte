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

    // The two `--background` values from ./layout.css, handed to mode-watcher so
    // the browser chrome follows the app's mode rather than the OS. The app's
    // mode is a preference in the user's config.json, so it can disagree with
    // `prefers-color-scheme`, and a light address bar over a dark page is the
    // seam that shows.
    const themeColors = { light: '#f8f8f8', dark: '#0a0a0a' };
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

<!-- Dark by default: this is a writing surface first, and a bright page is the
     complaint the app exists to answer. It is only the starting point — the
     mode is a preference like any other, so the moment a folder is adopted its
     config.json decides (see `workspace.applyTheme()`), and `defaultMode` is
     what a first run, or a run before any folder is picked, gets. Deliberately
     not "system": the OS preference is about every app, and this one has an
     answer of its own. -->
<ModeWatcher defaultMode="dark" {themeColors} />

<div class="flex h-full flex-col">
    {@render children()}
</div>
