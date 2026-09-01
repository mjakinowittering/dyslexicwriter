import { resetMode, setMode, toggleMode, userPrefersMode } from 'mode-watcher';

export type Theme = 'light' | 'dark' | 'system';

// Singleton theme store. Mirrors the class-based shape of the base stores
// (read/update methods), but theme is not an offline-syncable record — so it
// delegates persistence (localStorage) and the <html> class to mode-watcher rather
// than Dexie. mode-watcher stays the single source of truth; `read()` reads through
// to its reactive `userPrefersMode` state so external changes (e.g. the OS
// preference under 'system') reflect here without a second copy.
// Dark is the default — pinned at layout init in `src/routes/+layout.svelte`.
class ThemeStore {
    // Return the current preferred mode — 'light' | 'dark' | 'system'.
    read(): Theme {
        return userPrefersMode.current;
    }

    // Apply a mode: 'system' follows the OS preference, otherwise it is pinned.
    update(mode: Theme): void {
        if (mode === 'system') resetMode();
        else setMode(mode);
    }

    // Flip between light and dark.
    toggle(): void {
        toggleMode();
    }
}

export const themeStore = new ThemeStore();
