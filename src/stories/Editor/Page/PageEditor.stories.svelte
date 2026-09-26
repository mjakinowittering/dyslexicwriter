<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, waitFor } from 'storybook/test';

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
            showInvisibles: { control: 'boolean' },
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

    function paragraph(text: string) {
        return { type: 'paragraph', content: [{ type: 'text', text }] };
    }

    function listItem(text: string) {
        return { type: 'listItem', content: [paragraph(text)] };
    }

    function taskItem(text: string, checked: boolean) {
        return {
            type: 'taskItem',
            attrs: { checked },
            content: [paragraph(text)]
        };
    }

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

    // One of each kind of list, for the marker half of the highlight. A sentence
    // never crosses a block (`splitSentences` stops at the separator), so exactly
    // one item is ever lit — each item below is its own sentence, and its
    // neighbour is there to show the marker beside it staying dark.
    const ttsListSample = {
        type: 'doc',
        content: [
            paragraph(
                'A read-aloud sentence lights the marker beside it, whichever kind of list it sits in.'
            ),
            {
                type: 'bulletList',
                content: [
                    listItem('A bullet takes the highlight colour.'),
                    listItem('Its neighbour is left alone.')
                ]
            },
            {
                type: 'orderedList',
                attrs: { start: 1 },
                content: [
                    listItem('A number does the same.'),
                    listItem('So this one stays as it was.')
                ]
            },
            {
                type: 'taskList',
                content: [
                    taskItem('A checkbox tints with the rest.', false),
                    taskItem('And a ticked one still reads as done.', true)
                ]
            }
        ]
    };

    // Every kind of marker once: spaces, a hard break mid-paragraph, an empty
    // paragraph, and the textblock inside a list item.
    const invisiblesSample = {
        type: 'doc',
        content: [
            {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: 'The lantern room' }]
            },
            {
                type: 'paragraph',
                content: [
                    { type: 'text', text: 'A line that breaks' },
                    { type: 'hardBreak' },
                    { type: 'text', text: 'and carries on.' }
                ]
            },
            { type: 'paragraph' },
            paragraph('After an empty paragraph.'),
            {
                type: 'bulletList',
                content: [listItem('One point')]
            }
        ]
    };

    function text(value: string, marks: string[] = []) {
        return marks.length === 0
            ? { type: 'text', text: value }
            : {
                  type: 'text',
                  text: value,
                  marks: marks.map((type) => ({ type }))
              };
    }

    function cell(
        type: 'tableHeader' | 'tableCell',
        value: string,
        align?: string
    ) {
        return {
            type,
            attrs: align ? { align } : {},
            content: [paragraph(value)]
        };
    }

    // Every element the document can hold, once — for the restyle in layout.css,
    // and for the axe run to measure each colour in both themes.
    const proseSample = {
        type: 'doc',
        content: [
            {
                type: 'heading',
                attrs: { level: 1 },
                content: [text('The lighthouse keeper')]
            },
            {
                type: 'paragraph',
                content: [
                    text('Some words are '),
                    text('bold', ['bold']),
                    text(', some are '),
                    text('italic', ['italic']),
                    text(', one is '),
                    {
                        type: 'text',
                        text: 'a link',
                        marks: [
                            {
                                type: 'link',
                                attrs: { href: 'https://example.com' }
                            }
                        ]
                    },
                    text(', and one is '),
                    text('inline code', ['code']),
                    text('.')
                ]
            },
            { type: 'heading', attrs: { level: 2 }, content: [text('Lists')] },
            {
                type: 'bulletList',
                content: [listItem('A bullet'), listItem('Another')]
            },
            {
                type: 'orderedList',
                attrs: { start: 1 },
                content: [listItem('First'), listItem('Second')]
            },
            {
                type: 'taskList',
                content: [
                    taskItem('Still to do', false),
                    taskItem('Done', true)
                ]
            },
            { type: 'heading', attrs: { level: 3 }, content: [text('Quoted')] },
            {
                type: 'blockquote',
                content: [paragraph('The light must never go out.')]
            },
            {
                type: 'heading',
                attrs: { level: 4 },
                content: [text('Code and a table')]
            },
            {
                type: 'codeBlock',
                content: [text('const lamp = "lit";')]
            },
            {
                type: 'table',
                content: [
                    {
                        type: 'tableRow',
                        content: [
                            cell('tableHeader', 'Night'),
                            cell('tableHeader', 'Hours', 'right')
                        ]
                    },
                    {
                        type: 'tableRow',
                        content: [
                            cell('tableCell', 'Monday'),
                            cell('tableCell', '11', 'right')
                        ]
                    },
                    {
                        type: 'tableRow',
                        content: [
                            cell('tableCell', 'Tuesday'),
                            cell('tableCell', '9', 'right')
                        ]
                    },
                    {
                        type: 'tableRow',
                        content: [
                            cell('tableCell', 'Wednesday'),
                            cell('tableCell', '12', 'right')
                        ]
                    }
                ]
            },
            { type: 'horizontalRule' },
            paragraph('The end.')
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
    let listEditor = $state<TipTapEditor>();

    // The list-marker ink, as the browser resolves it in whichever theme the
    // story is running under. Read through a probe rather than copied here, so
    // the story checks that the markers follow `--marker` in layout.css, not
    // that the token holds one particular value.
    function markerInk(): string {
        const probe = document.createElement('span');
        probe.style.color = 'var(--marker)';
        document.body.append(probe);
        const ink = getComputedStyle(probe).color;
        probe.remove();
        return ink;
    }

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

    // Sentence 1 is the first bullet — sentence 0 is the intro paragraph, and
    // each list item is its own sentence after that.
    $effect(() => {
        if (listEditor) showHighlight(listEditor, 1, 'bullet');
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

<Story
    name="Prose"
    args={{ editable: true, content: proseSample }}
    parameters={{
        docs: {
            description: {
                story: 'Every element a document can hold, in the restyle from layout.css: weight-only bold, markers in the marker ink, a quote set apart by its rule alone, code as a chip, links in their own colour, and a banded table that scrolls in its own box.'
            }
        }
    }}
    play={async ({ canvas, canvasElement }) => {
        // Typography sits in a later cascade layer than `@layer base`, so each
        // of these is a check that an unlayered override actually won.
        const quote = canvasElement.querySelector('blockquote') as HTMLElement;
        await expect(getComputedStyle(quote).fontStyle).toBe('normal');
        const quoted = quote.querySelector('p') as HTMLElement;
        await expect(getComputedStyle(quoted, '::before').content).toBe('none');

        const code = canvasElement.querySelector('p > code') as HTMLElement;
        await expect(getComputedStyle(code, '::before').content).toBe('none');
        await expect(getComputedStyle(code).fontWeight).toBe('400');

        const link = canvas.getByText('a link');
        await expect(getComputedStyle(link).fontWeight).toBe('400');

        const bold = canvas.getByText('bold');
        await expect(getComputedStyle(bold).fontWeight).toBe('700');
        await expect(getComputedStyle(bold).color).toBe(
            getComputedStyle(bold.parentElement as HTMLElement).color
        );

        const h4 = canvas.getByRole('heading', { level: 4 });
        await expect(parseFloat(getComputedStyle(h4).fontSize)).toBeGreaterThan(
            parseFloat(
                getComputedStyle(code.parentElement as HTMLElement).fontSize
            )
        );

        const table = canvasElement.querySelector('table') as HTMLElement;
        await expect(getComputedStyle(table).overflowX).toBe('auto');
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
    name="Invisible Characters"
    args={{
        editable: true,
        content: invisiblesSample,
        showInvisibles: true
    }}
    parameters={{
        docs: {
            description: {
                story: 'The `showInvisibles` preference: a dot on every space, a return arrow before a hard break, and a pilcrow at the end of every paragraph — an empty one included. Decorations drawn as generated content, so none of it is in the document JSON or the markdown.'
            }
        }
    }}
    play={async ({ canvasElement }) => {
        await waitFor(() =>
            expect(
                canvasElement.querySelectorAll('.invisible-space').length
            ).toBeGreaterThan(0)
        );
        await expect(
            canvasElement.querySelectorAll('.invisible-break')
        ).toHaveLength(1);
        // Heading, two paragraphs, the empty one, a list item's paragraph — and
        // the empty paragraph TrailingNode appends after the list so the writer
        // can type past it. It is really there, so it gets its pilcrow too.
        await expect(
            canvasElement.querySelectorAll('.invisible-paragraph')
        ).toHaveLength(6);
    }}
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

<Story
    name="TTS Highlight (Lists)"
    args={{ editable: true, content: ttsListSample }}
    parameters={{
        docs: {
            description: {
                story: "The marker half of the highlight. A spoken sentence inside a list item marks that item's bullet, number or checkbox with `.tts-marker` and leaves its neighbours alone; every marker is drawn in the `--marker` ink, lit or not. Driven by a `Decoration.node` on the item, because the markers are drawn as generated content and a real `<input>`, neither of which an inline span over the text can reach."
            }
        }
    }}
    play={async ({ canvasElement }) => {
        // Queried off the lit sentence rather than by its words: the word
        // highlight splits the text across three spans, so there is no one
        // element holding the whole of it.
        const litItem = () =>
            canvasElement.querySelector('.tts-sentence')?.closest('li');
        const marked = () => canvasElement.querySelectorAll('.tts-marker');

        // The decoration has to land on the item rather than the text — a class
        // on the wrong element styles nothing, and nothing about that would show
        // up in a screenshot.
        await waitFor(() => expect(litItem()).toHaveClass('tts-marker'));
        // And on that item alone: a list item's range encloses everything
        // nested in it, so lighting every item the range touches is the
        // obvious way to get this wrong.
        await expect(marked()).toHaveLength(1);

        // Every marker takes the marker ink, lit or not. Its colour reaches the
        // `::before` through Typography's variables, which layout.css sets
        // outside every layer — inside one, Typography's own grey would win.
        const TINT = markerInk();
        const bullet = litItem() as HTMLElement;
        await expect(getComputedStyle(bullet, '::before').color).toBe(TINT);
        const neighbour = bullet.nextElementSibling as HTMLElement;
        await expect(getComputedStyle(neighbour, '::before').color).toBe(TINT);

        // A task item's `<li>` comes from a TipTap node view rather than being
        // rendered plainly, so ProseMirror has to merge the node decoration onto
        // it — the one part of this that isn't the ordinary path. Its marker is
        // a real checkbox rather than generated content, so it tints through
        // `accent-color`. Move the highlight there, check, then put it back for
        // the screenshot.
        if (!listEditor) return;
        showHighlight(listEditor, 5, 'checkbox');
        await waitFor(() => expect(litItem()).toHaveClass('tts-marker'));
        const task = litItem() as HTMLElement;
        await expect(task).toHaveAttribute('data-checked');
        const box = task.querySelector('input[type="checkbox"]') as HTMLElement;
        await expect(getComputedStyle(box).accentColor).toBe(TINT);
        showHighlight(listEditor, 1, 'bullet');
    }}
>
    {#snippet template(args)}
        <div class="bg-background min-h-96 w-full p-6">
            <PageEditor {...args} bind:editor={listEditor} />
        </div>
    {/snippet}
</Story>
