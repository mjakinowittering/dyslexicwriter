import {
    CheckListIcon,
    CodeSquareIcon,
    Heading01Icon,
    Heading02Icon,
    Heading03Icon,
    Heading04Icon,
    LeftToRightBlockQuoteIcon,
    LeftToRightListBulletIcon,
    LeftToRightListNumberIcon,
    SourceCodeIcon,
    TextBoldIcon,
    TextIcon,
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
// The menus read the same table: a menu item is a row here, and the trigger
// works out what to show from the same `value`s `getFormattingActive` reports.
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
// listed. `value` is `heading1`…`heading4` because a menu needs one key per
// item, while the editor only knows a single `heading` node with a level.
//
// `setHeading` rather than `toggleHeading`: the text-style menu is radio-style,
// so choosing the level already in force leaves it there. Turning a heading
// back into body text is the menu's Text item.
export function headingDefinition(level: HeadingLevel): FormatToggleDefinition {
    return {
        icon: HEADING_ICONS[level],
        label: () => m.content_format_heading_hint({ level }),
        hint: () => m.content_format_heading_hint({ level }),
        shortcut: ['Mod', 'Alt', String(level)],
        value: `heading${level}`,
        wordBoundary: false,
        run: (chain) => chain.setHeading({ level }),
        isActive: (editor) => editor.isActive('heading', { level })
    };
}

// Body text: the text-style menu's first item, and the way back from a heading.
// "Active" means no heading is — a paragraph inside a list or a quote is still
// body text as far as the writer's text style goes.
export const paragraphDefinition: FormatToggleDefinition = {
    icon: TextIcon,
    label: () => m.content_format_paragraph_hint(),
    hint: () => m.content_format_paragraph_hint(),
    // StarterKit's Paragraph binds Mod+Alt+0, beside the headings' Mod+Alt+n.
    shortcut: ['Mod', 'Alt', '0'],
    value: 'paragraph',
    wordBoundary: false,
    run: (chain) => chain.setParagraph(),
    isActive: (editor) =>
        !HEADING_LEVELS.some((level) => editor.isActive('heading', { level }))
};

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
    code: {
        icon: SourceCodeIcon,
        label: () => m.content_format_code(),
        hint: () => m.content_format_code_hint(),
        // StarterKit's Code mark binds Mod+E.
        shortcut: ['Mod', 'E'],
        value: 'code',
        wordBoundary: true,
        run: (chain) => chain.toggleCode(),
        isActive: (editor) => editor.isActive('code')
    },
    // The rows from here down are menu items rather than buttons, so their
    // `label` is the item's own text: there is no "Toggle …" button to name.
    blockquote: {
        icon: LeftToRightBlockQuoteIcon,
        label: () => m.content_format_blockquote_hint(),
        hint: () => m.content_format_blockquote_hint(),
        shortcut: ['Mod', 'Shift', 'B'],
        value: 'blockquote',
        wordBoundary: false,
        run: (chain) => chain.toggleBlockquote(),
        isActive: (editor) => editor.isActive('blockquote')
    },
    bulletList: {
        icon: LeftToRightListBulletIcon,
        label: () => m.content_format_bullet_list_hint(),
        hint: () => m.content_format_bullet_list_hint(),
        shortcut: ['Mod', 'Shift', '8'],
        value: 'bulletList',
        wordBoundary: false,
        run: (chain) => chain.toggleBulletList(),
        isActive: (editor) => editor.isActive('bulletList')
    },
    orderedList: {
        icon: LeftToRightListNumberIcon,
        label: () => m.content_format_ordered_list_hint(),
        hint: () => m.content_format_ordered_list_hint(),
        shortcut: ['Mod', 'Shift', '7'],
        value: 'orderedList',
        wordBoundary: false,
        run: (chain) => chain.toggleOrderedList(),
        isActive: (editor) => editor.isActive('orderedList')
    },
    taskList: {
        icon: CheckListIcon,
        label: () => m.content_format_task_list_hint(),
        hint: () => m.content_format_task_list_hint(),
        // TaskList's own default, so the tooltip is describing a keymap the
        // extension already binds — and it lands beside the bullet list's
        // Mod+Shift+8 and the numbered list's Mod+Shift+7.
        shortcut: ['Mod', 'Shift', '9'],
        value: 'taskList',
        wordBoundary: false,
        run: (chain) => chain.toggleTaskList(),
        isActive: (editor) => editor.isActive('taskList')
    },
    codeBlock: {
        icon: CodeSquareIcon,
        label: () => m.content_format_code_block_hint(),
        hint: () => m.content_format_code_block_hint(),
        // StarterKit's CodeBlock binds Mod+Alt+C.
        shortcut: ['Mod', 'Alt', 'C'],
        value: 'codeBlock',
        wordBoundary: false,
        run: (chain) => chain.toggleCodeBlock(),
        isActive: (editor) => editor.isActive('codeBlock')
    }
} satisfies Record<string, FormatToggleDefinition>;

export type FormatToggleName = keyof typeof formatToggles;

// One item of the text-style menu. `short` is what the trigger reads while the
// style is in force; `preview` sets the item's label at the style's own scale,
// so the menu shows the result before it is chosen. Size and weight only — the
// menu stays in Geist.
export interface TextStyle {
    definition: FormatToggleDefinition;
    short: () => string;
    preview: string;
}

const HEADING_PREVIEWS: Record<HeadingLevel, string> = {
    1: 'text-xl font-bold',
    2: 'text-[17px] font-bold',
    3: 'text-[15px] font-bold',
    4: 'text-sm font-bold'
};

// Built from HEADING_LEVELS, so a level offered here is one the table defines.
export const TEXT_STYLES: TextStyle[] = [
    {
        definition: paragraphDefinition,
        short: () => m.content_format_paragraph_hint(),
        preview: 'text-sm font-normal'
    },
    ...HEADING_LEVELS.map((level) => ({
        definition: headingDefinition(level),
        short: () => m.content_format_heading_short({ level }),
        preview: HEADING_PREVIEWS[level]
    }))
];

// What the Lists and Blocks menus hold, as rows of the table above rather than
// a second list of names.
export const LIST_TOGGLES: FormatToggleDefinition[] = [
    formatToggles.bulletList,
    formatToggles.orderedList,
    formatToggles.taskList
];

export const BLOCK_TOGGLES: FormatToggleDefinition[] = [
    formatToggles.blockquote,
    formatToggles.codeBlock
];

// Every stateful control there is, text styles included, in table order. That
// is also the order `getFormattingActive` reports in; the toggle group and the
// menus treat it as a set, so the order is only ever cosmetic.
export function allFormatToggles(): FormatToggleDefinition[] {
    return [
        ...Object.values(formatToggles),
        ...TEXT_STYLES.map((style) => style.definition)
    ];
}
