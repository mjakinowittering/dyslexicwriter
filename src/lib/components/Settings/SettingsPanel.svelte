<script lang="ts">
    import { Cancel01Icon } from '@hugeicons/core-free-icons';
    import { prefersReducedMotion } from 'svelte/motion';
    import { fade, slide } from 'svelte/transition';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import Button from '$lib/components/ui/button/button.svelte';
    import Label from '$lib/components/ui/label/label.svelte';
    import * as RadioGroup from '$lib/components/ui/radio-group';
    import { Switch } from '$lib/components/ui/switch';

    import { motionDuration, motionEasing } from '$lib/config/motion';
    import type { Font } from '$lib/models/config.model';
    import * as m from '$lib/paraglide/messages';
    import { workspace } from '$lib/stores/workspace.svelte';
    import type { PreferenceStore } from '$lib/stores/workspace.svelte';

    // The settings panel. Every control here writes straight through to
    // config.json in the user's folder — there is no separate "save".
    //
    // `store` defaults to the app's workspace — it is a prop only so a story or a
    // test can show a chosen theme/font without a folder on disk behind it.
    let {
        // eslint-disable-next-line no-useless-assignment -- $bindable default read via the template binding, invisible to ESLint
        open = $bindable(false),
        store = workspace
    }: { open?: boolean; store?: PreferenceStore } = $props();

    const isDark = $derived(store.theme === 'dark');

    // One switch for both phases, so they can never drift apart and reduced
    // motion collapses the whole reveal rather than half of it. Page.svelte
    // gates its squeeze tween on the same signal so the sheet stays in step.
    const duration = $derived(
        prefersReducedMotion.current ? 0 : motionDuration
    );

    async function onFontChange(value: string) {
        await store.setFont(value as Font);
    }

    async function onThemeChange(dark: boolean) {
        // setTheme applies the change to <html> and writes it to config.json, so
        // the preference travels with the user's folder.
        await store.setTheme(dark ? 'dark' : 'light');
    }
</script>

<!-- Full viewport height, fixed width, on the right. It takes a column in the
     editor's grid rather than floating, so opening it compresses the document
     leftwards instead of covering it.

     Two elements, not one: the project's two-phase sequential reveal (see the
     `animations` skill). The <aside> is the panel itself — it carries the
     surface (background and border) and the width, and `slide` on the x axis
     clips with `overflow: hidden` so the fixed-width content inside is never
     squashed or re-wrapped while the column opens. The inner element is only the
     controls, fading in once the panel has finished opening. The surface must sit
     on the sliding element rather than the fading one, or phase one opens an
     empty gap and the panel arrives with its contents instead of before them.
     The per-direction delays reverse the order on the way out: the controls fade,
     then the panel closes. -->
<aside
    class="border-border bg-card h-full shrink-0 border-l"
    in:slide={{ axis: 'x', duration, easing: motionEasing }}
    out:slide={{ axis: 'x', duration, delay: duration, easing: motionEasing }}
>
    <div
        class="flex h-full w-72 flex-col overflow-y-auto"
        in:fade={{ duration, easing: motionEasing, delay: duration }}
        out:fade={{ duration, easing: motionEasing }}
    >
        <header
            class="border-border flex h-14 shrink-0 items-center justify-between border-b px-4"
        >
            <h2 class="text-sm font-semibold">{m.settings_title()}</h2>
            <Button
                aria-label={m.settings_close()}
                onclick={() => (open = false)}
                size="icon"
                variant="ghost"
            >
                <Icon icon={Cancel01Icon} />
            </Button>
        </header>

        <!-- Every control below writes straight through to config.json, and when
             the file cannot be read those writes are refused so the user's real
             preferences are not overwritten by the defaults standing in for them.
             Said here because this is where the switch was moved: `workspace.error`
             is only rendered on the Files screen, so from the editor a refused
             write would otherwise look exactly like a saved one. -->
        {#if store.settingsUnreadable}
            <p class="text-destructive px-4 pt-4 text-sm">
                {m.settings_read_error()}
            </p>
        {/if}

        <div class="flex flex-col gap-8 p-4">
            <section class="flex flex-col gap-3">
                <h3
                    class="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
                >
                    {m.settings_font()}
                </h3>
                <RadioGroup.Root
                    onValueChange={onFontChange}
                    value={store.font}
                >
                    <div class="flex items-center gap-2">
                        <RadioGroup.Item id="font-dyslexic" value="dyslexic" />
                        <!-- The label previews the choice: it is the one bit of chrome
                         that renders in the reading font. -->
                        <Label
                            class="reading-font font-normal"
                            for="font-dyslexic"
                        >
                            {m.settings_font_dyslexic()}
                        </Label>
                    </div>
                    <div class="flex items-center gap-2">
                        <RadioGroup.Item id="font-sans" value="sans" />
                        <Label class="font-normal" for="font-sans">
                            {m.settings_font_sans()}
                        </Label>
                    </div>
                </RadioGroup.Root>
            </section>

            <section class="flex flex-col gap-3">
                <h3
                    class="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
                >
                    {m.settings_theme()}
                </h3>
                <div class="flex items-center justify-between">
                    <Label class="font-normal" for="theme-dark">
                        {isDark
                            ? m.settings_theme_dark()
                            : m.settings_theme_light()}
                    </Label>
                    <Switch
                        checked={isDark}
                        id="theme-dark"
                        onCheckedChange={onThemeChange}
                    />
                </div>
            </section>
        </div>
    </div>
</aside>
