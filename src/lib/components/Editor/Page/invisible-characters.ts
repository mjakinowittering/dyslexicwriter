import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';

// Markers for the characters a writer cannot see: a dot on every space, a return
// arrow before every hard break, a pilcrow at the end of every paragraph. The
// `showInvisibles` preference in config.json switches them on.
//
// Decorations only, in the shape of `tts/tiptap-tts-highlight.ts` — never marks
// or nodes. They are not in `editor.getJSON()`, so they cannot reach the
// markdown, and read-aloud's text map walks the document rather than the page,
// so it never meets them either. The glyphs themselves are CSS generated content
// (see PageEditor.svelte): nothing here puts a character anywhere a selection,
// a copy or a screen reader could pick it up.
//
// Tabs and non-breaking spaces are deliberately not marked — the same set
// TipTap's own (paid) extension and `prosemirror-invisibles` draw.

export type InvisibleKind = 'space' | 'break' | 'paragraph';

export interface Invisible {
    kind: InvisibleKind;
    // A space's own position, a hard break's position, or the end of a
    // textblock's content — where the pilcrow sits.
    pos: number;
}

interface InvisibleState {
    enabled: boolean;
    decorations: DecorationSet;
}

// Meta on a transaction carries the new on/off value. The key stays private:
// `setInvisibleCharacters` is the whole of what callers need.
const invisibleCharactersKey = new PluginKey<InvisibleState>(
    'invisibleCharacters'
);

const SPACE = 0x20;

/**
 * Every invisible character in the document, in document order.
 *
 * Pure, and exported for its tests. One walk: text nodes are scanned for plain
 * spaces, hard breaks are taken whole, and every textblock contributes its
 * content end — so an empty paragraph, the one a writer most needs to see, gets
 * a pilcrow too.
 */
export function findInvisibles(doc: ProseMirrorNode): Invisible[] {
    const found: Invisible[] = [];

    doc.descendants((node, pos) => {
        if (node.isText) {
            const text = node.text ?? '';
            for (let i = 0; i < text.length; i++) {
                if (text.charCodeAt(i) === SPACE) {
                    found.push({ kind: 'space', pos: pos + i });
                }
            }
            return false;
        }

        if (node.type.name === 'hardBreak') {
            found.push({ kind: 'break', pos });
            return false;
        }

        if (node.isTextblock) {
            found.push({ kind: 'paragraph', pos: pos + node.nodeSize - 1 });
        }

        return true;
    });

    // A textblock is visited before its children, so its end lands in the list
    // ahead of the text it closes. Nothing shares a position, so a plain sort
    // restores document order.
    return found.sort((a, b) => a.pos - b.pos);
}

function marker(kind: 'break' | 'paragraph'): () => HTMLElement {
    return () => {
        const span = document.createElement('span');
        span.className = `invisible-${kind}`;
        span.setAttribute('aria-hidden', 'true');
        return span;
    };
}

function buildDecorations(doc: ProseMirrorNode): DecorationSet {
    const decorations = findInvisibles(doc).map(({ kind, pos }) => {
        switch (kind) {
            // An inline decoration over the space itself, so the dot is drawn
            // on top of it without adding width to the line.
            case 'space':
                return Decoration.inline(pos, pos + 1, {
                    class: 'invisible-space'
                });
            // Before the break, so the arrow ends the line it breaks.
            case 'break':
                return Decoration.widget(pos, marker('break'), {
                    side: -1,
                    key: 'invisible-break'
                });
            // After the caret at the end of a line, so typing there lands
            // before the pilcrow rather than past it.
            case 'paragraph':
                return Decoration.widget(pos, marker('paragraph'), {
                    side: 1,
                    key: 'invisible-paragraph'
                });
        }
    });

    return DecorationSet.create(doc, decorations);
}

export const InvisibleCharactersExtension = Extension.create({
    name: 'invisibleCharacters',

    addProseMirrorPlugins() {
        return [
            new Plugin<InvisibleState>({
                key: invisibleCharactersKey,
                state: {
                    init: () => ({
                        enabled: false,
                        decorations: DecorationSet.empty
                    }),
                    apply(tr, old) {
                        const meta = tr.getMeta(invisibleCharactersKey) as
                            | boolean
                            | undefined;
                        const enabled = meta ?? old.enabled;

                        if (!enabled) {
                            return old.enabled
                                ? { enabled, decorations: DecorationSet.empty }
                                : old;
                        }

                        // Rebuilt rather than mapped when the document changes:
                        // an edit can create or remove a space anywhere, and one
                        // linear walk is the same order of work CharacterCount
                        // already does on every transaction. Anything else — a
                        // selection move, a read-aloud highlight — leaves every
                        // position where it was.
                        if (!old.enabled || tr.docChanged) {
                            return {
                                enabled,
                                decorations: buildDecorations(tr.doc)
                            };
                        }

                        return old;
                    }
                },
                props: {
                    decorations(state) {
                        return invisibleCharactersKey.getState(state)
                            ?.decorations;
                    }
                }
            })
        ];
    }
});

// Show or hide the markers. A doc-preserving transaction kept out of the undo
// history; because the document node is untouched, the editor's identity check
// can never read it as an edit. A no-op when nothing would change, so an effect
// can call it freely.
export function setInvisibleCharacters(
    view: EditorView,
    enabled: boolean
): void {
    if (invisibleCharactersKey.getState(view.state)?.enabled === enabled) {
        return;
    }

    const tr = view.state.tr.setMeta(invisibleCharactersKey, enabled);
    tr.setMeta('addToHistory', false);
    view.dispatch(tr);
}
