import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
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

// The two node types that carry a marker of their own. A bullet or a number is
// generated content on the `listItem` (see the marker rules in layout.css) and a
// checkbox is a real `<input>` inside the `taskItem` — neither is reachable from
// an inline span over the text, which is why the marker needs a decoration on the
// item itself.
const LIST_ITEM_TYPES = new Set(['listItem', 'taskItem']);

/**
 * The list items whose own text the given range covers.
 *
 * Pure, and exported for its tests. Works off the textblocks the range touches
 * rather than the items directly: a list item's range covers everything nested
 * inside it, so asking which *items* the range overlaps would light every
 * ancestor of the spoken sentence. The block holding the text has exactly one
 * item as its parent, so resolving upwards from there lights the item the
 * sentence is actually in and no other.
 */
export function listItemsInRange(doc: ProseMirrorNode, range: Range): Range[] {
    const items: Range[] = [];
    const seen = new Set<number>();

    doc.nodesBetween(range.from, range.to, (node, pos, parent) => {
        // Only ever interested in the block holding the text. Returning false
        // stops the walk descending into its text nodes, which say nothing
        // about the item above them.
        if (!node.isTextblock) return true;
        if (!parent || !LIST_ITEM_TYPES.has(parent.type.name)) return false;

        // `nodesBetween` includes a node that merely touches the range, so a
        // sentence ending exactly where the next block's text begins would
        // otherwise light that block's marker too. Compare against the block's
        // content rather than the node, and require a real overlap.
        const contentFrom = pos + 1;
        const contentTo = pos + node.nodeSize - 1;
        if (contentFrom >= range.to || contentTo <= range.from) return false;

        // `pos - 1` would be wrong for anything but an item's first block —
        // resolving is what makes a second paragraph in the same item land on
        // the item rather than a position inside it.
        const $block = doc.resolve(pos);
        const from = $block.before($block.depth);
        if (seen.has(from)) return false;

        seen.add(from);
        items.push({ from, to: from + parent.nodeSize });
        return false;
    });

    return items;
}

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
                            // The marker beside the writing, lit with it. Driven
                            // by the sentence and never the word: the sentence is
                            // the half that is exact on every platform, and a
                            // marker flickering per word would be noise anyway.
                            for (const item of listItemsInRange(
                                tr.doc,
                                meta.sentence
                            )) {
                                decorations.push(
                                    Decoration.node(item.from, item.to, {
                                        class: 'tts-marker'
                                    })
                                );
                            }
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
