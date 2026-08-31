<script lang="ts">
    import { Moon02Icon, Sun01Icon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as Tooltip from '$lib/components/Tooltip';
    import Button from '$lib/components/ui/button/button.svelte';

    import * as m from '$lib/paraglide/messages';
    import { workspace } from '$lib/stores/workspace.svelte';
    import type { PreferenceStore } from '$lib/stores/workspace.svelte';

    // Flip the theme from the app header. `setTheme` both applies the change to
    // <html> and writes it to config.json in the user's folder, so there is no
    // separate save — the same path the settings panel's switch takes.
    //
    // The header only renders this once a folder is open. Before then there is
    // nowhere to persist a theme to (config.json lives in the folder, and
    // localStorage is not an option), so a toggle would change the page and be
    // forgotten by the next launch.
    let { store = workspace }: { store?: PreferenceStore } = $props();

    const isDark = $derived(store.theme === 'dark');

    // The button offers the theme you would be moving to, so the icon and the
    // label say the same thing: a sun to go light, a moon to go dark.
    const label = $derived(
        isDark ? m.header_theme_to_light() : m.header_theme_to_dark()
    );

    async function onclick() {
        await store.setTheme(isDark ? 'light' : 'dark');
    }
</script>

<Tooltip.Provider>
    <Tooltip.Root>
        <Tooltip.Trigger>
            {#snippet child({ props })}
                <Button
                    {...props}
                    aria-label={label}
                    {onclick}
                    size="icon"
                    variant="ghost"
                >
                    <Icon icon={isDark ? Sun01Icon : Moon02Icon} />
                </Button>
            {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom">
            <p>{label}</p>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>
