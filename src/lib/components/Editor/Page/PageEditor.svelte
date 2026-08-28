<script lang="ts">
    import type { JSONContent } from '@tiptap/core';
    import { Editor } from '@tiptap/core';
    import { CharacterCount, Placeholder } from '@tiptap/extensions';
    import { onDestroy, onMount, untrack } from 'svelte';

    import { documentExtensions } from '$lib/markdown';
    import type { Font } from '$lib/models/config.model';
    import * as m from '$lib/paraglide/messages';
    import { TtsHighlightExtension } from '$lib/tts/tiptap-tts-highlight';
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
    // Editable only: true once the incoming `content` has seeded the doc, so a late
    // server payload can't clobber in-progress typing.
    let loaded = $state(false);
    // Read-only only: signature of the document last applied to the editor. Read-only
    // has no draft/cursor to protect and its `content` can arrive or change after
    // mount (async load, cross-tab refresh) — so it re-applies reactively rather than
    // seeding once, which made population depend on fragile mount timing.
    let appliedSig = $state<string | null>(null);

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
            onTransaction: ({ editor: e }) => {
                wordCount = wordsOf(e);
                onTransaction?.(e);
            },
            onUpdate: () => onUpdate?.(),
            onBlur: () => onBlur?.()
        });
    }

    onMount(() => {
        if (!editorElement) return;
        editor = createEditor(editorElement, content);
        // Seed the count from content already present at mount so the reading-time
        // estimate doesn't pop in on the first transaction. `loaded` marks the
        // editable seed as done (the read-only sync effect keys off `appliedSig`
        // instead, and still (re)applies content post-mount). Editable mounts usually
        // start empty (content arrives async), where this is a harmless 0.
        if (content !== null) {
            loaded = true;
            wordCount = wordsOf(editor);
        }
    });

    // Editable: seed the editor once when the initial document arrives after mount.
    // emitUpdate: false keeps this server load from marking the page dirty; the
    // `loaded` guard stops a later server echo from overwriting in-progress typing.
    $effect(() => {
        if (!editable || !editor || loaded || content === null) return;
        const incoming = content;
        untrack(() => {
            editor?.commands.setContent(incoming, { emitUpdate: false });
            if (editor) wordCount = wordsOf(editor);
            loaded = true;
        });
    });

    // Read-only: keep the rendered document in sync with `content` reactively, so it
    // populates regardless of mount timing and reflects live SSE/resync refreshes
    // in place (no remount flicker). The signature guard skips redundant setContent
    // when the document is unchanged (ContentBody hands a new object each render).
    $effect(() => {
        if (editable || !editor || content === null) return;
        const incoming = content;
        const sig = JSON.stringify(incoming);
        if (sig === appliedSig) return;
        untrack(() => {
            editor?.commands.setContent(incoming, { emitUpdate: false });
            if (editor) wordCount = wordsOf(editor);
            appliedSig = sig;
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
    /* Read-aloud playback highlight. Applied to ProseMirror decoration spans (see
       tiptap-tts-highlight.ts), so the classes are dynamic — :global is required.
       Static colours only: state-driven motion here would be hand-rolled CSS, which
       the project forbids (highlight advances by decoration change, not transition). */
    :global(.tts-sentence) {
        --tts-tint: rgb(250 204 21 / 0.18);
        background-color: var(--tts-tint);
        border-radius: 0.15rem;
    }
    :global(.tts-word) {
        --tts-tint: rgb(250 204 21 / 0.45);
        background-color: var(--tts-tint);
        border-radius: 0.15rem;
        box-shadow: 0 0 0 1px rgb(202 138 4 / 0.35);
    }
    :global(.dark .tts-sentence) {
        --tts-tint: rgb(250 204 21 / 0.14);
    }
    :global(.dark .tts-word) {
        --tts-tint: rgb(250 204 21 / 0.38);
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
        /* The word's ring traced the old, taller box, so it cannot follow the
           band down. The heavier tint is what distinguishes the word here. */
        box-shadow: none;
    }
</style>
