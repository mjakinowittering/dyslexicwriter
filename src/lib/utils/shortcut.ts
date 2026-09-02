// Keyboard-shortcut labels for the toolbar tooltips.
//
// Call sites write TipTap's own token names — `Mod` for the primary modifier,
// which the editor binds to Command on Apple platforms and Control everywhere
// else. Formatting happens here so a tooltip can never state a key the keymap
// doesn't have.

// The symbols Apple platforms use, and the words everywhere else does. Anything
// not listed is a plain key (`B`, `1`) and passes straight through.
const APPLE_SYMBOLS: Record<string, string> = {
    Mod: '⌘',
    Ctrl: '⌃',
    Alt: '⌥',
    Shift: '⇧'
};

const OTHER_NAMES: Record<string, string> = {
    Mod: 'Ctrl',
    Ctrl: 'Ctrl',
    Alt: 'Alt',
    Shift: 'Shift'
};

// Apple writes modifiers in a fixed order regardless of how they were typed:
// Control, Option, Shift, Command, then the key. Menus everywhere on the system
// follow it, so a tooltip that doesn't looks wrong rather than merely different.
const APPLE_ORDER = ['Ctrl', 'Alt', 'Shift', 'Mod'];

/**
 * Whether this platform uses the Command key as the primary modifier.
 *
 * Mirrors `isiOS() || isMacOS()` from `@tiptap/core` — the very test TipTap runs
 * when it decides whether `Mod` binds to Meta or Control. Inlined rather than
 * imported so this module (and its test) stays clear of the editor bundle; if
 * TipTap's test ever changes, this has to follow it.
 *
 * `navigator.platform` is deprecated, and it stays anyway: TipTap reads it too,
 * so matching it is the whole point. Detecting the platform some better way —
 * `userAgentData.platform` — would be correct in isolation and wrong here the
 * first time the two disagreed, because the tooltip would then name a key the
 * keymap doesn't bind. The mirror is worth more than the modern API.
 */
export function usesCommandKey(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

/**
 * Render a shortcut for display: `['Mod', 'Shift', '8']` becomes `⇧⌘8` on a Mac
 * and `Ctrl+Shift+8` everywhere else.
 *
 * `apple` defaults to the running platform and is a parameter only so both
 * renderings can be tested without touching `navigator`.
 */
export function formatShortcut(
    keys: string[],
    apple = usesCommandKey()
): string {
    if (!apple) return keys.map((k) => OTHER_NAMES[k] ?? k).join('+');

    // Modifiers sort into Apple's order; the key itself always stays last.
    const sorted = [...keys].sort((a, b) => {
        const ai = APPLE_ORDER.indexOf(a);
        const bi = APPLE_ORDER.indexOf(b);
        return (
            (ai === -1 ? APPLE_ORDER.length : ai) -
            (bi === -1 ? APPLE_ORDER.length : bi)
        );
    });
    return sorted.map((k) => APPLE_SYMBOLS[k] ?? k).join('');
}
