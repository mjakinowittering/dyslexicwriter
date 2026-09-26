import { Editor, type JSONContent } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';

import { applyFormat } from '$lib/components/Editor/Format/commands';
import {
    formatToggles,
    HEADING_LEVELS,
    headingDefinition,
    paragraphDefinition
} from '$lib/components/Editor/Format/definitions';
import { getFormattingActive } from '$lib/components/Editor/Format/index';

import { documentExtensions } from '$lib/markdown/extensions';

// The rows the collapsed toolbar added: inline code, code block and body text.
// Each is run through `applyFormat` — the one path both a button and a menu
// item take — against a real editor on the document's own extension set, so a
// row naming a command the schema lacks fails here rather than in the writer's
// hands.

let editor: Editor | undefined;

afterEach(() => {
    editor?.destroy();
    editor = undefined;
});

function mount(content: JSONContent): Editor {
    editor = new Editor({
        element: document.createElement('div'),
        extensions: documentExtensions(),
        content
    });
    return editor;
}

const paragraph = (text: string): JSONContent => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
});

describe('inline code', () => {
    it('marks the selection as code, and reports itself active there', () => {
        const instance = mount(paragraph('Call toMarkdown here.'));
        instance.commands.setTextSelection({ from: 6, to: 16 });

        expect(formatToggles.code.isActive(instance)).toBe(false);
        applyFormat(instance, formatToggles.code);

        expect(formatToggles.code.isActive(instance)).toBe(true);
        expect(JSON.stringify(instance.getJSON())).toContain('"type":"code"');
    });

    it('takes the whole word under a collapsed caret, like bold', () => {
        const instance = mount(paragraph('Call toMarkdown here.'));
        instance.commands.setTextSelection(9);

        applyFormat(instance, formatToggles.code);

        const inline: JSONContent[] =
            instance.getJSON().content?.[0]?.content ?? [];
        const marked = inline.find((node) =>
            node.marks?.some((mark) => mark.type === 'code')
        );
        expect(marked?.text).toBe('toMarkdown');
    });
});

describe('code block', () => {
    it('turns the block into a code block and back again', () => {
        const instance = mount(paragraph('const a = 1;'));
        instance.commands.setTextSelection(3);

        applyFormat(instance, formatToggles.codeBlock);
        expect(formatToggles.codeBlock.isActive(instance)).toBe(true);
        expect(instance.getJSON().content?.[0]?.type).toBe('codeBlock');

        applyFormat(instance, formatToggles.codeBlock);
        expect(formatToggles.codeBlock.isActive(instance)).toBe(false);
        expect(instance.getJSON().content?.[0]?.type).toBe('paragraph');
    });
});

describe('text style', () => {
    it('reports body text active exactly when no heading is', () => {
        const instance = mount(paragraph('A line'));
        instance.commands.setTextSelection(2);
        expect(paragraphDefinition.isActive(instance)).toBe(true);

        for (const level of HEADING_LEVELS) {
            applyFormat(instance, headingDefinition(level));
            expect(paragraphDefinition.isActive(instance)).toBe(false);
            expect(getFormattingActive(instance)).toContain(`heading${level}`);
            expect(getFormattingActive(instance)).not.toContain('paragraph');
        }
    });

    it('turns every heading level back into body text', () => {
        for (const level of HEADING_LEVELS) {
            const instance = mount(paragraph('A line'));
            instance.commands.setTextSelection(2);
            applyFormat(instance, headingDefinition(level));

            applyFormat(instance, paragraphDefinition);

            expect(paragraphDefinition.isActive(instance)).toBe(true);
            expect(instance.getJSON()).toEqual(paragraph('A line'));
            instance.destroy();
        }
    });

    // Radio-style: choosing the level already in force leaves it there, rather
    // than toggling the heading off the way the old buttons did.
    it('leaves a heading alone when its own level is chosen again', () => {
        const instance = mount(paragraph('A line'));
        instance.commands.setTextSelection(2);
        const h2 = headingDefinition(2);

        applyFormat(instance, h2);
        applyFormat(instance, h2);

        expect(h2.isActive(instance)).toBe(true);
    });
});
