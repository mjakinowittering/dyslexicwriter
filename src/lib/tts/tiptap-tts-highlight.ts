import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';

import type { Range } from './text-map';

// View-only highlight for text-to-speech playback. Implemented as ProseMirror
// decorations (never marks/nodes) so it NEVER appears in `editor.getJSON()` and
// therefore can't leak into the server's derived markdown. The current word and its
// enclosing sentence are decorated with CSS classes and advanced as playback moves.

export interface TtsHighlight {
    word: Range | null;
    sentence: Range | null;
}

// Meta on a transaction carries the new highlight; `null` clears it. Absence of the
// meta means an ordinary edit — remap the existing decorations to the new doc.
const ttsHighlightKey = new PluginKey<DecorationSet>('ttsHighlight');

export const TtsHighlightExtension = Extension.create({
    name: 'ttsHighlight',

    addProseMirrorPlugins() {
        return [
            new Plugin<DecorationSet>({
                key: ttsHighlightKey,
                state: {
                    init: () => DecorationSet.empty,
                    apply(tr, old) {
                        const meta = tr.getMeta(ttsHighlightKey) as
                            | TtsHighlight
                            | null
                            | undefined;
                        // No highlight meta → keep decorations, mapped through edits.
                        if (meta === undefined)
                            return old.map(tr.mapping, tr.doc);
                        if (meta === null) return DecorationSet.empty;

                        const decorations: Decoration[] = [];
                        // Sentence first so the narrower word span nests inside it.
                        if (meta.sentence) {
                            decorations.push(
                                Decoration.inline(
                                    meta.sentence.from,
                                    meta.sentence.to,
                                    { class: 'tts-sentence' }
                                )
                            );
                        }
                        if (meta.word) {
                            decorations.push(
                                Decoration.inline(
                                    meta.word.from,
                                    meta.word.to,
                                    {
                                        class: 'tts-word'
                                    }
                                )
                            );
                        }
                        return DecorationSet.create(tr.doc, decorations);
                    }
                },
                props: {
                    decorations(state) {
                        return ttsHighlightKey.getState(state);
                    }
                }
            })
        ];
    }
});

// Set (or clear, with `null`) the playback highlight. Dispatches a doc-preserving
// transaction kept out of the undo history and off the "dirty" signal.
export function setTtsHighlight(
    view: EditorView,
    value: TtsHighlight | null
): void {
    const tr = view.state.tr.setMeta(ttsHighlightKey, value);
    tr.setMeta('addToHistory', false);
    view.dispatch(tr);
}

/**
 * Whether a transaction is one of ours — a highlight move and nothing else.
 *
 * A read fires these constantly (per word, where the engine reports boundaries),
 * and every one wakes TipTap's `onTransaction` subscribers. None of what they
 * recompute — word count, active formatting, undo/redo availability — can have
 * changed, because a highlight transaction touches neither the document nor the
 * selection. Subscribers doing real work should check this and return.
 *
 * The plugin key stays private: this is the whole of what callers need, and
 * exporting the key would invite writing the meta from outside this module.
 */
export function isTtsHighlightTransaction(tr: Transaction): boolean {
    return tr.getMeta(ttsHighlightKey) !== undefined;
}
