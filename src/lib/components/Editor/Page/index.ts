import type { Editor, JSONContent } from '@tiptap/core';

import type { Font } from '$lib/models/config.model';

import Root from './Page.svelte';
import EditorSurface from './PageEditor.svelte';

export interface PageProps {
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
