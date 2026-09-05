<script lang="ts">
    import { ModeWatcher, setMode, userPrefersMode } from 'mode-watcher';
    import type { Snippet } from 'svelte';

    import './layout.css';

    import favicon from '$lib/assets/favicon.svg';
    import { defaultConfig } from '$lib/models/config.model';

    let { children }: { children: Snippet } = $props();

    // Pin the shipped default before <ModeWatcher> can decide for itself.
    //
    // Its `defaultMode` prop never gets a chance to apply here. mode-watcher's
    // `userPrefersMode` is a module-level PersistedState, so merely importing
    // the library writes "system" into localStorage — and the component's own
    // onMount then reads that back, sees a valid stored mode, and honours it
    // instead of `defaultMode`. A first run (or one after the browser's storage
    // is cleared) therefore followed `prefers-color-scheme`, which on a light
    // OS is exactly the bright page this app exists to answer.
    //
    // "system" is not one of the app's themes — `themeValues` is light | dark —
    // so encountering it here can only mean nothing has chosen yet, and the
    // shipped default is the right answer. This runs during layout init, ahead
    // of that mount and of the first paint, so there is no flash to see.
    if (userPrefersMode.current === 'system') setMode(defaultConfig().theme);

    // The theme is applied imperatively by the workspace store when a folder is
    // adopted and when the setting changes — see `workspace.applyTheme()`. Doing
    // it from an $effect here loops against mode-watcher, which writes to the
    // same <html> element. The font preference never reaches <html>: it dresses
    // the document surface alone.

    // The two theme grounds, read from ./layout.css and handed to mode-watcher so
    // the browser chrome follows the app's mode rather than the OS. The app's
    // mode is a preference in the user's config.json, so it can disagree with
    // `prefers-color-scheme`, and a light address bar over a dark page is the
    // seam that shows.
    //
    // Read rather than restated. These used to be hand-converted hex copies of
    // `--ground-light` / `--ground-dark`, which is a second definition of a
    // colour in a file that is not allowed to hold one. Both tokens sit on
    // `:root` unconditionally, so the dark ground is readable while the light
    // theme is showing.
    //
    // Undefined when the stylesheet has not landed yet: mode-watcher then leaves
    // `<meta name="theme-color">` alone, which is better than painting the chrome
    // a colour we guessed.
    function groundColors(): { light: string; dark: string } | undefined {
        if (typeof document === 'undefined') return undefined;

        const styles = getComputedStyle(document.documentElement);
        const light = styles.getPropertyValue('--ground-light').trim();
        const dark = styles.getPropertyValue('--ground-dark').trim();

        return light && dark ? { light, dark } : undefined;
    }

    const themeColors = groundColors();
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

<!-- Dark by default: this is a writing surface first, and a bright page is the
     complaint the app exists to answer. It is only the starting point — the
     mode is a preference like any other, so the moment a folder is adopted its
     config.json decides (see `workspace.applyTheme()`), and the default is what
     a first run, or a run before any folder is picked, gets. Deliberately not
     "system": the OS preference is about every app, and this one has an answer
     of its own — which is why the script above pins it rather than trusting
     `defaultMode`, kept here only as the declared fallback. -->
<ModeWatcher defaultMode="dark" {themeColors} />

<div class="flex h-full flex-col">
    {@render children()}
</div>
