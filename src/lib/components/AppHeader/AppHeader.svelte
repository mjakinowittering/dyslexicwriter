<script lang="ts">
    import { Brain02Icon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';
    import { workspace } from '$lib/stores/workspace.svelte';
    import type { PreferenceStore } from '$lib/stores/workspace.svelte';

    import AppHeaderMenu from './AppHeaderMenu.svelte';
    import AppHeaderThemeToggle from './AppHeaderThemeToggle.svelte';

    // The app chrome for `/` — shown across every state of it, from the
    // unsupported-browser screen through to the Files list. The editor is not
    // part of this: it has its own toolbar, and its own copy of the mark.
    //
    // `hasFolder` gates the two controls rather than the whole bar. The mark
    // should be there from the first paint, but a theme toggle has nowhere to
    // save to before a folder is chosen and the menu's actions are both about a
    // folder that doesn't exist yet.
    //
    // Store-free apart from a defaulted `store`, the way Welcome.svelte is, so
    // Storybook can drive it without a directory handle behind it.
    let {
        hasFolder = false,
        onChangeFolder,
        onLeaveFolder,
        store = workspace
    }: {
        hasFolder?: boolean;
        onChangeFolder: () => void;
        onLeaveFolder: () => void;
        store?: PreferenceStore;
    } = $props();
</script>

<!-- Sized and bordered to match the editor's title row, so moving between the
     two reads as one app rather than two screens. -->
<header
    class="border-border flex h-14 shrink-0 items-center justify-between border-b px-3"
>
    <!-- The mark is drawn here rather than shared with the editor's ToolbarLogo:
         that one is sized and padded for the tall rail beside it. Both are
         inert — a two-route app gives the mark nowhere to navigate. -->
    <div class="flex items-center gap-2">
        <Icon class="text-primary size-8" icon={Brain02Icon} />
        <span class="text-base font-semibold">{m.header_app_name()}</span>
    </div>

    {#if hasFolder}
        <div class="flex items-center gap-1">
            <AppHeaderThemeToggle {store} />
            <AppHeaderMenu {onChangeFolder} {onLeaveFolder} />
        </div>
    {/if}
</header>
