import {
    Heading01Icon,
    Heading02Icon,
    Heading03Icon,
    Heading04Icon,
    LeftToRightBlockQuoteIcon,
    LeftToRightListBulletIcon,
    LeftToRightListNumberIcon,
    TextBoldIcon,
    TextItalicIcon
} from '@hugeicons/core-free-icons';
import type { HugeiconsIcon } from '@hugeicons/svelte';
import type { ChainedCommands, Editor } from '@tiptap/core';
import type { ComponentProps } from 'svelte';

import * as m from '$lib/paraglide/messages';

// THE definition of every stateful formatting control: what it looks like, what
// it says, what it does, and how it knows it is on.
//
// `value` and `isActive` are the point of this file. A toggle hands `value` to
// the group as its pressed key, and `getFormattingActive` asks the editor which
// controls are on — and those two lists used to be written out separately, one
// in each component and one in `index.ts`. A rename in either place silently
// stopped a button lighting up. Now the question is derived from the same table
// that renders the buttons, so it cannot be asked about a name none of them use.
//
// The toolbar is capped by product decision (see CLAUDE.md and the
// content-editor skill). This table is not an invitation to extend it.

type IconData = ComponentProps<typeof HugeiconsIcon>['icon'];

export type HeadingLevel = 1 | 2 | 3 | 4;

export const HEADING_LEVELS: HeadingLevel[] = [1, 2, 3, 4];

export interface FormatToggleDefinition {
    icon: IconData;
    // Functions rather than strings: a message is resolved where it is rendered,
    // not once at module load.
    label: () => string;
    hint: () => string;
    // TipTap's own token names — `Mod` is Command on Apple platforms and Control
    // everywhere else. `formatShortcut` turns them into something readable.
    shortcut: string[];
    // The key this control reports itself under to the toggle group.
    value: string;
    // Apply across the whole word under a collapsed caret rather than doing
    // nothing. Marks want this; block-level toggles already act on the block.
    wordBoundary: boolean;
    run: (chain: ChainedCommands) => ChainedCommands;
    isActive: (editor: Editor) => boolean;
}

const HEADING_ICONS: Record<HeadingLevel, IconData> = {
    1: Heading01Icon,
    2: Heading02Icon,
    3: Heading03Icon,
    4: Heading04Icon
};

// Headings are one control repeated four times, so they are built rather than
// listed. `value` is `heading1`…`heading4` because the group needs one key per
// button, while the editor only knows a single `heading` node with a level.
export function headingDefinition(level: HeadingLevel): FormatToggleDefinition {
    return {
        icon: HEADING_ICONS[level],
        label: () => m.content_format_heading({ level }),
        hint: () => m.content_format_heading_hint({ level }),
        shortcut: ['Mod', 'Alt', String(level)],
        value: `heading${level}`,
        wordBoundary: false,
        run: (chain) => chain.toggleHeading({ level }),
        isActive: (editor) => editor.isActive('heading', { level })
    };
}

export const formatToggles = {
    bold: {
        icon: TextBoldIcon,
        label: () => m.content_format_bold(),
        hint: () => m.content_format_bold_hint(),
        shortcut: ['Mod', 'B'],
        value: 'bold',
        wordBoundary: true,
        run: (chain) => chain.toggleBold(),
        isActive: (editor) => editor.isActive('bold')
    },
    italic: {
        icon: TextItalicIcon,
        label: () => m.content_format_italic(),
        hint: () => m.content_format_italic_hint(),
        shortcut: ['Mod', 'I'],
        value: 'italic',
        wordBoundary: true,
        run: (chain) => chain.toggleItalic(),
        isActive: (editor) => editor.isActive('italic')
    },
    blockquote: {
        icon: LeftToRightBlockQuoteIcon,
        label: () => m.content_format_blockquote(),
        hint: () => m.content_format_blockquote_hint(),
        shortcut: ['Mod', 'Shift', 'B'],
        value: 'blockquote',
        wordBoundary: false,
        run: (chain) => chain.toggleBlockquote(),
        isActive: (editor) => editor.isActive('blockquote')
    },
    bulletList: {
        icon: LeftToRightListBulletIcon,
        label: () => m.content_format_bullet_list(),
        hint: () => m.content_format_bullet_list_hint(),
        shortcut: ['Mod', 'Shift', '8'],
        value: 'bulletList',
        wordBoundary: false,
        run: (chain) => chain.toggleBulletList(),
        isActive: (editor) => editor.isActive('bulletList')
    },
    orderedList: {
        icon: LeftToRightListNumberIcon,
        label: () => m.content_format_ordered_list(),
        hint: () => m.content_format_ordered_list_hint(),
        shortcut: ['Mod', 'Shift', '7'],
        value: 'orderedList',
        wordBoundary: false,
        run: (chain) => chain.toggleOrderedList(),
        isActive: (editor) => editor.isActive('orderedList')
    }
} satisfies Record<string, FormatToggleDefinition>;

export type FormatToggleName = keyof typeof formatToggles;

// Every stateful control there is, headings included, in table order. That is
// also the order `getFormattingActive` reports in; the toggle group treats its
// value as a set, so the order is only ever cosmetic.
export function allFormatToggles(): FormatToggleDefinition[] {
    return [
        ...Object.values(formatToggles),
        ...HEADING_LEVELS.map(headingDefinition)
    ];
}
