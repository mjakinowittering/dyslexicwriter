<script lang="ts" module>
    // How often the editor checks its own content against what it last reported.
    //
    // The check is an object-identity comparison, so this can be short without
    // costing anything: it is the interval between a change nobody told us about
    // and the store hearing of it, and nothing else.
    export const CONTENT_CHECK_MS = 2_000;
</script>

<script lang="ts">
    import type { JSONContent } from '@tiptap/core';
    import { Editor } from '@tiptap/core';
    import { CharacterCount, Placeholder } from '@tiptap/extensions';
    import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
    import { onDestroy, onMount, untrack } from 'svelte';

    import { documentExtensions } from '$lib/markdown';
    import type { Font } from '$lib/models/config.model';
    import * as m from '$lib/paraglide/messages';
    import {
        isTtsHighlightTransaction,
        TtsHighlightExtension
    } from '$lib/tts/tiptap-tts-highlight';
    import { cn } from '$lib/utils';

    let {
        editor = $bindable<Editor | undefined>(undefined),
        // eslint-disable-next-line no-useless-assignment -- $bindable default read via the template binding, invisible to ESLint
        wordCount = $bindable(0),
        editable = true,
        content = null,
        font = 'sans',
        placeholder = m.content_editor_placeholder(),
        onTransaction,
        onUpdate,
        onBlur,
        onDropImage,
        class: className
    }: {
        editor?: Editor;
        wordCount?: number;
        editable?: boolean;
        // Writes a dropped/pasted image into the document's own folder and
        // returns the relative path to reference it by.
        onDropImage?: (file: File) => Promise<string | null>;
        // Initial document as TipTap JSON — the source of truth in this app. May
        // arrive asynchronously after the editor mounts (loaded once via the effect).
        content?: JSONContent | null;
        // The reading font (config.json). It dresses the document surface only —
        // the app chrome around it stays in the interface font. Driven by the
        // page, not read from the workspace store here.
        font?: Font;
        placeholder?: string;
        onTransaction?: (editor: Editor) => void;
        // Fired on edit/blur as a "dirty" signal only — the page reads editor.getJSON()
        // at save time, so no payload is passed here.
        onUpdate?: () => void;
        onBlur?: () => void;
        // Extra classes for the editor wrapper (e.g. padding around the document).
        class?: string;
    } = $props();

    let editorElement = $state<HTMLElement>();
    // True once the incoming `content` has seeded the doc. A document is read off
    // disk asynchronously, so it usually arrives after mount; this marks the seed as
    // done so a later echo of the same prop can't overwrite what has been typed
    // since.
    let loaded = $state(false);

    // The document last handed to `onUpdate`.
    //
    // ProseMirror nodes are immutable: a transaction that changes nothing hands
    // back the same object, so identity is an exact answer to "has anything
    // changed since?" — no traversal, no serialising a document on a timer.
    //
    // Deliberately a plain `let`. Nothing renders from it, and a ProseMirror node
    // behind a $state proxy is the bug the TTS highlight already documents.
    let reportedDoc: ProseMirrorNode | null = null;

    // Tell the page there is writing it has not seen — but only if there is.
    //
    // `onUpdate` firing is the fast path, not the guarantee. TipTap emits it from
    // its own dispatch, so a change that reaches the document by some other route
    // — a browser extension rewriting the contenteditable, a transaction carrying
    // `preventUpdate` — never raises it, and the store's every exit path is a
    // no-op on a document it believes is clean. This is what closes that: the
    // question becomes what the editor is holding, not what it remembered to say.
    export function reconcile(): void {
        if (!editor || editor.isDestroyed) return;
        if (editor.state.doc === reportedDoc) return;

        reportedDoc = editor.state.doc;
        onUpdate?.();
    }

    // Content that arrived rather than being written: the constructor's, and the
    // seeding effect's. Recording it is what stops a freshly-opened document
    // reading as an edit and being written straight back — TrailingNode's
    // appended paragraph and all.
    function markSeeded(): void {
        reportedDoc = editor?.state.doc ?? null;
    }

    function wordsOf(instance: Editor): number {
        return (
            (instance.storage.characterCount.words() as number | undefined) ?? 0
        );
    }

    function createEditor(
        element: HTMLElement,
        initial: JSONContent | null
    ): Editor {
        return new Editor({
            autofocus: editable,
            content: initial ?? undefined,
            editable,
            editorProps: {
                attributes: {
                    // TipTap renders the writing surface as a contenteditable
                    // with role="textbox", which has no name of its own — without
                    // this a screen reader announces the whole document as an
                    // unlabelled text box. The placeholder is the empty-state
                    // prompt, not a name, so it cannot stand in for it.
                    'aria-label': m.content_editor_label(),
                    class: 'prose dark:prose-invert prose-sm sm:prose lg:prose-lg prose-headings:font-semibold prose-li:my-1 [&_li_p]:my-1.5 prose-h1:text-xl sm:prose-h1:text-2xl lg:prose-h1:text-3xl prose-h2:text-lg sm:prose-h2:text-xl lg:prose-h2:text-2xl prose-h3:text-base sm:prose-h3:text-lg lg:prose-h3:text-xl prose-h4:text-sm sm:prose-h4:text-base lg:prose-h4:text-lg 2xl:prose-xl 2xl:prose-h1:text-4xl 2xl:prose-h2:text-3xl 2xl:prose-h3:text-2xl 2xl:prose-h4:text-xl 3xl:prose-2xl 3xl:prose-h1:text-5xl 3xl:prose-h2:text-4xl 3xl:prose-h3:text-3xl 3xl:prose-h4:text-2xl focus:rounded-xl focus:outline-none grow prose-img:rounded-md prose-table:text-sm'
                },
                handleDrop: (view, event) => {
                    const files = event.dataTransfer?.files;
                    const file = files?.[0];
                    if (!onDropImage || !file?.type.startsWith('image/')) {
                        return false;
                    }

                    // Claim the drop before awaiting, or the browser navigates
                    // away to the dropped file.
                    event.preventDefault();

                    const at = view.posAtCoords({
                        left: event.clientX,
                        top: event.clientY
                    })?.pos;

                    void onDropImage(file).then((src) => {
                        if (!src || !editor) return;
                        editor
                            .chain()
                            .focus()
                            .insertContentAt(
                                at ?? editor.state.selection.from,
                                {
                                    type: 'image',
                                    attrs: { src, alt: file.name }
                                }
                            )
                            .run();
                    });

                    return true;
                }
            },
            element,
            // The node/mark set comes from the shared definition used by BOTH
            // markdown converters — see $lib/markdown/extensions.ts. Placeholder,
            // CharacterCount and the TTS highlight add no content nodes, so they
            // stay local to the editor.
            extensions: [
                ...documentExtensions({ trailingNode: editable }),
                Placeholder.configure({
                    placeholder,
                    emptyEditorClass:
                        'cursor-text before:content-[attr(data-placeholder)] before:absolute before:text-muted-foreground before:opacity-50 before:pointer-events-none'
                }),
                CharacterCount.configure({
                    wordCounter: (text) =>
                        text.split(/\s+/).filter((word) => word !== '').length
                }),
                // Read-aloud highlight — decorations only, no content nodes, so it
                // never touches the JSON the markdown is derived from.
                TtsHighlightExtension
            ],
            // Read-aloud's highlight is a real transaction, dispatched for every
            // word the engine reports — dozens a second on a document of any size.
            // It changes neither the document nor the selection, so recounting
            // words (a full-document textBetween plus a split) and waking the
            // page's own handler (active formatting, undo/redo availability) is
            // work with no possible result. Skipping it is what keeps the tab
            // responsive through a long read.
            onTransaction: ({ editor: e, transaction }) => {
                if (isTtsHighlightTransaction(transaction)) return;
                wordCount = wordsOf(e);
                onTransaction?.(e);
            },
            onUpdate: () => reconcile(),
            // Reconcile BEFORE the page's own handler: it flushes, and a flush
            // is a no-op until the store has been told there is something to
            // write. Accepting an extension's suggestion blurs the editor, so
            // for those this is the exit path that matters.
            onBlur: () => {
                reconcile();
                onBlur?.();
            }
        });
    }

    onMount(() => {
        if (!editorElement) return;
        editor = createEditor(editorElement, content);
        // Seed the count from content already present at mount so the reading-time
        // estimate doesn't pop in on the first transaction, and mark the seed as
        // done. A mount usually starts empty — the document is still being read off
        // disk — where this is a harmless 0 and the effect below does the seeding.
        if (content !== null) {
            loaded = true;
            wordCount = wordsOf(editor);
        }
        markSeeded();

        // The heartbeat. Blur and the page's exit paths cover a writer who leaves;
        // this covers the one who doesn't — accepting a spelling suggestion can be
        // the last thing that happens before the tab sits idle for an hour, with
        // no keystroke, no blur and nothing else armed to notice.
        if (!editable) return;

        const beat = setInterval(reconcile, CONTENT_CHECK_MS);
        return () => clearInterval(beat);
    });

    // Seed the editor once when the document arrives after mount. emitUpdate: false
    // keeps this load from marking the page dirty; the `loaded` guard stops a later
    // echo from overwriting in-progress typing.
    //
    // addToHistory: false is the one that matters. setContent only sets the
    // `preventUpdate` meta, so without this the document's own arrival is an
    // undoable step — Mod+Z on a freshly opened document would replace it with
    // the empty doc the editor was constructed with, and autosave would write
    // that to disk.
    $effect(() => {
        if (!editable || !editor || loaded || content === null) return;
        const incoming = content;
        untrack(() => {
            editor
                ?.chain()
                .setMeta('addToHistory', false)
                .setContent(incoming, { emitUpdate: false })
                .run();
            if (editor) wordCount = wordsOf(editor);
            markSeeded();
            loaded = true;
        });
    });

    onDestroy(() => {
        editor?.destroy();
    });
</script>

<!-- The font class sits on the wrapper, not on `editorProps.attributes`: those are
     fixed when the editor is constructed, and ProseMirror inherits from here anyway. -->
<div
    bind:this={editorElement}
    class={cn('cursor-text', font === 'dyslexic' && 'reading-font', className)}
></div>

<style>
    /* Read-aloud playback highlight — a lit band, rhyming with the LCARS chirps in
       $lib/tts/chirp.ts. Applied to ProseMirror decoration spans (see
       tiptap-tts-highlight.ts), so the classes are dynamic — :global is required.
       Static colours only: state-driven motion here would be hand-rolled CSS, which
       the project forbids (highlight advances by decoration change, not transition).

       Functional colour, so it lives with the component rather than in layout.css —
       the documented exception that keeps every theme token there at chroma 0.

       One rule set serves both themes. At 0.92 the band all but covers the ground
       beneath it, so light and dark composite to within a few percent of each other,
       and the ink is dark on both by definition. The sentence and the word are a
       tonal pair rather than two alphas of one colour: 0.92 against 1.0 is not a
       visible step. */
    :global(.tts-sentence) {
        --tts-tint: rgb(255 204 153 / 0.92);
        background-color: var(--tts-tint);
        color: oklch(0.145 0 0);
        border-radius: 0.15rem;
    }
    :global(.tts-word) {
        --tts-tint: rgb(255 153 0);
        background-color: var(--tts-tint);
        color: oklch(0.145 0 0);
        border-radius: 0.15rem;
    }

    /* Ink over anything the band covers. Typography's element rules (strong, a, code,
       headings) are wrapped in :where(), so they carry the specificity of `.prose`
       alone — a single-class descendant selector ties with them and wins or loses on
       source order. Doubling the class settles it, so a bold word inside a spoken
       sentence can't keep prose-invert's near-white on the lit band. */
    :global(.tts-sentence.tts-sentence *),
    :global(.tts-word.tts-word *) {
        color: oklch(0.145 0 0);
    }

    /* The reading font needs the same band drawn differently. A background colour
       fills the font's own content box, and OpenDyslexic's is 1.82em tall against
       Geist's 1.31em — so the letters float in a slab, and because it is taller
       than .prose's 1.75 line-height the bands of a wrapped sentence touch with no
       gap between the lines. Painting the tint as a fixed-height gradient instead
       takes the band's height away from the font's metrics, so it hugs the letters
       here the way it already does in the interface font. `clone` gives each line
       of a wrapped sentence its own band rather than one sliced box. */
    :global(.reading-font .tts-sentence),
    :global(.reading-font .tts-word) {
        background-color: transparent;
        background-image: linear-gradient(var(--tts-tint), var(--tts-tint));
        background-position: 0 0.35em;
        background-repeat: no-repeat;
        background-size: 100% 1.3em;
        -webkit-box-decoration-break: clone;
        box-decoration-break: clone;
    }
</style>
