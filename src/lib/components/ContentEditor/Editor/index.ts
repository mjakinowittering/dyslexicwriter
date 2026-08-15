import type { Editor, JSONContent } from '@tiptap/core';

import type { Font } from '$lib/models/config.model';

import Root from './Canvas.svelte';
import EditorSurface from './Editor.svelte';

export interface ContentEditorProps {
    editor?: Editor;
    wordCount?: number;
    editable?: boolean;
    content?: JSONContent | null;
    font?: Font;
    placeholder?: string;
    onTransaction?: (editor: Editor) => void;
    onUpdate?: () => void;
    onBlur?: () => void;
}

export { EditorSurface as Editor, Root };
