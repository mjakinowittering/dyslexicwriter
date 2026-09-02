<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import PageEditor from '$lib/components/Editor/Page/PageEditor.svelte';

    const { Story } = defineMeta({
        title: 'Editor/Page/PageEditor',
        component: PageEditor,
        tags: ['autodocs'],
        argTypes: {
            editor: { control: false },
            wordCount: { control: false },
            content: { control: false },
            editable: { control: 'boolean' },
            font: { control: 'select', options: ['sans', 'dyslexic'] },
            placeholder: { control: 'text' },
            onTransaction: { control: false },
            onUpdate: { control: false },
            onBlur: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'TipTap-backed rich-text editor, and the writing surface of the app. TipTap JSON (`content`) is the editing source of truth; the node/mark set is limited to what survives the markdown round-trip, since markdown is what lands on disk — see `$lib/markdown`. Seeded once when the document arrives, which is normally after mount: reading it off the filesystem is asynchronous.'
                }
            }
        }
    });

    // Read-aloud harness content. Deliberately long enough to wrap, and stocked with
    // the shapes whose ink sits closest to (or past) the edge of the box the browser
    // paints a background across — W A V y g j q f, brackets, a trailing full stop.
    const ttsSample = {
        type: 'doc',
        content: [
            {
                type: 'paragraph',
                content: [
                    {
                        type: 'text',
                        text: 'Watching the grey jackdaws quarrel over a fig, Vaughan wondered why anybody bothered arguing (again) about typography and the exact shape of a highlight. The quick brown fox jumps over the lazy dog.'
                    }
                ]
            },
            {
                type: 'paragraph',
                content: [
                    {
                        type: 'text',
                        text: 'Jaded zombies acted quaintly but kept driving their oxen forward.'
                    }
                ]
            }
        ]
    };

    const sample = {
        type: 'doc',
        content: [
            {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: 'Getting started' }]
            },
            {
                type: 'paragraph',
                content: [
                    { type: 'text', text: 'This is a ' },
                    { type: 'text', marks: [{ type: 'bold' }], text: 'rich' },
                    { type: 'text', text: ' text document rendered by TipTap.' }
                ]
            },
            {
                type: 'bulletList',
                content: [
                    {
                        type: 'listItem',
                        content: [
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: 'First point' }]
                            }
                        ]
                    },
                    {
                        type: 'listItem',
                        content: [
                            {
                                type: 'paragraph',
                                content: [
                                    { type: 'text', text: 'Second point' }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    };
</script>

<script lang="ts">
    import type { Editor as TipTapEditor } from '@tiptap/core';

    import {
        buildUtterance,
        rangeToPos,
        splitSentences
    } from '$lib/tts/text-map';
    import { setTtsHighlight } from '$lib/tts/tiptap-tts-highlight';

    // The playback highlight is decorations, not content, so it can't be set through
    // args — and the word half only ever appears where the speech engine emits
    // `boundary` events, which no engine on Linux does. These bindings are the only
    // way to see either band while working on how it's drawn.
    let sansEditor = $state<TipTapEditor>();
    let dyslexicEditor = $state<TipTapEditor>();

    // Light a sentence, and a word inside it, exactly as playback would: the ranges
    // come from the same pure helpers the SpeechController uses, so the harness can't
    // drift from what the reader actually sees.
    function showHighlight(
        instance: TipTapEditor,
        sentenceIndex: number,
        word: string
    ): void {
        const { doc } = instance.state;
        const utterance = buildUtterance(doc, 0, doc.content.size);
        const sentence = splitSentences(utterance.text)[sentenceIndex];
        if (!sentence) return;

        const wordStart = utterance.text.indexOf(word, sentence.start);
        setTtsHighlight(instance.view, {
            sentence: rangeToPos(
                utterance.segments,
                sentence.start,
                sentence.end
            ),
            word:
                wordStart < 0
                    ? null
                    : rangeToPos(
                          utterance.segments,
                          wordStart,
                          wordStart + word.length
                      )
        });
    }

    $effect(() => {
        if (sansEditor) showHighlight(sansEditor, 0, 'jackdaws');
    });

    $effect(() => {
        if (dyslexicEditor) showHighlight(dyslexicEditor, 0, 'jackdaws');
    });
</script>

<Story
    name="Editable"
    args={{ editable: true, content: sample }}
    play={async ({ canvas }) => {
        // The JSON is the source of truth: what TipTap renders comes from it,
        // headings and marks included.
        await expect(
            canvas.getByRole('heading', { name: 'Getting started' })
        ).toBeInTheDocument();
        await expect(canvas.getByText('rich')).toBeInTheDocument();
        await expect(canvas.getByText('First point')).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div class="bg-background min-h-96 w-full p-6">
            <PageEditor {...args} />
        </div>
    {/snippet}
</Story>

<Story name="Empty (Placeholder)" args={{ editable: true, content: null }}>
    {#snippet template(args)}
        <div class="bg-background min-h-96 w-full p-6">
            <PageEditor {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Dyslexic Font"
    args={{ editable: true, content: sample, font: 'dyslexic' }}
>
    {#snippet template(args)}
        <div class="bg-background min-h-96 w-full p-6">
            <PageEditor {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="TTS Highlight"
    args={{ editable: true, content: ttsSample }}
    parameters={{
        docs: {
            description: {
                story: 'Read-aloud playback highlight in the interface font — the sentence band with the current word inside it. Set through ProseMirror decorations, so nothing here reaches the document JSON.'
            }
        }
    }}
>
    {#snippet template(args)}
        <div class="bg-background min-h-96 w-full p-6">
            <PageEditor {...args} bind:editor={sansEditor} />
        </div>
    {/snippet}
</Story>

<Story
    name="TTS Highlight (Dyslexic)"
    args={{ editable: true, content: ttsSample, font: 'dyslexic' }}
    parameters={{
        docs: {
            description: {
                story: "The same highlight in the reading font. OpenDyslexic's ink runs past the advance widths the background is painted across, so the band is widened here to keep the letters inside it."
            }
        }
    }}
>
    {#snippet template(args)}
        <div class="bg-background min-h-96 w-full p-6">
            <PageEditor {...args} bind:editor={dyslexicEditor} />
        </div>
    {/snippet}
</Story>
