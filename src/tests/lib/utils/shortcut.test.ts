import { describe, expect, it } from 'vitest';

import { formatShortcut } from '$lib/utils/shortcut';

// `apple` is passed explicitly throughout so both renderings are covered on one
// machine — the tooltips are the only place a Mac writer learns the keys, and
// they were stating Ctrl to everybody.
describe('formatShortcut', () => {
    it('names Mod after the platform', () => {
        expect(formatShortcut(['Mod', 'B'], false)).toBe('Ctrl+B');
        expect(formatShortcut(['Mod', 'B'], true)).toBe('⌘B');
    });

    it('puts Apple modifiers in Command-last order, unseparated', () => {
        expect(formatShortcut(['Mod', 'Alt', '1'], true)).toBe('⌥⌘1');
        expect(formatShortcut(['Mod', 'Shift', '8'], true)).toBe('⇧⌘8');
    });

    it('keeps the written order and the + joins off Apple', () => {
        expect(formatShortcut(['Mod', 'Alt', '1'], false)).toBe('Ctrl+Alt+1');
        expect(formatShortcut(['Mod', 'Shift', '8'], false)).toBe(
            'Ctrl+Shift+8'
        );
    });

    it('keeps a literal Ctrl as Control on Apple, not Command', () => {
        expect(formatShortcut(['Ctrl', 'Mod', 'K'], true)).toBe('⌃⌘K');
    });

    it('passes an unrecognised key straight through', () => {
        expect(formatShortcut(['Mod', 'Enter'], false)).toBe('Ctrl+Enter');
        expect(formatShortcut(['Mod', 'Enter'], true)).toBe('⌘Enter');
    });
});
