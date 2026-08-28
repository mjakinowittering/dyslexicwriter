import { getSchema } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import { Node } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';

import {
    buildUtterance,
    chunkUtterance,
    nextSentenceStart,
    rangeToPos,
    sentenceStartAt,
    sentenceStartIndices,
    skipBackTarget,
    splitSentences
} from '$lib/tts/text-map';

// A DOM-free ProseMirror schema, so these run in the node test project.
const schema = getSchema([StarterKit]);

function doc(json: JSONContent): Node {
    return Node.fromJSON(schema, json);
}

const twoParagraphs = doc({
    type: 'doc',
    content: [
        {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello world.' }]
        },
        {
            type: 'paragraph',
            content: [{ type: 'text', text: 'How are you? Fine.' }]
        }
    ]
});

// A long sentence (several chunks at a 40-char cap) followed by two short ones.
const mixed = doc({
    type: 'doc',
    content: [
        {
            type: 'paragraph',
            content: [
                {
                    type: 'text',
                    text: `${'alpha bravo '.repeat(10)}end. Short one. Short two.`
                }
            ]
        }
    ]
});

describe('buildUtterance', () => {
    it('joins blocks with a newline separator', () => {
        const { text } = buildUtterance(
            twoParagraphs,
            0,
            twoParagraphs.content.size
        );
        expect(text).toBe('Hello world.\nHow are you? Fine.');
    });

    it('clips to a selection range', () => {
        // Positions 3..6 fall inside "Hello world." → "llo".
        const { text, segments } = buildUtterance(twoParagraphs, 3, 6);
        expect(text).toBe('llo');
        expect(segments[0].pmStart).toBe(3);
    });

    it('returns empty text for an empty document', () => {
        const empty = doc({ type: 'doc', content: [{ type: 'paragraph' }] });
        const { text, segments } = buildUtterance(empty, 0, empty.content.size);
        expect(text).toBe('');
        expect(segments).toHaveLength(0);
    });
});

describe('rangeToPos', () => {
    // The offset→position map round-trips: the document text at the mapped
    // positions equals the utterance substring for the same offsets.
    const utterance = buildUtterance(
        twoParagraphs,
        0,
        twoParagraphs.content.size
    );

    it.each([
        ['Hello', utterance.text.indexOf('Hello')],
        ['world', utterance.text.indexOf('world')],
        ['How', utterance.text.indexOf('How')],
        ['Fine', utterance.text.indexOf('Fine')]
    ])('maps the word "%s" back to the right positions', (word, start) => {
        const range = rangeToPos(
            utterance.segments,
            start,
            start + word.length
        );
        expect(range).not.toBeNull();
        expect(twoParagraphs.textBetween(range!.from, range!.to)).toBe(word);
    });

    it('maps a sentence spanning to its terminator', () => {
        const start = utterance.text.indexOf('How');
        const end = utterance.text.indexOf('?') + 1; // include the "?"
        const range = rangeToPos(utterance.segments, start, end);
        expect(range).not.toBeNull();
        expect(twoParagraphs.textBetween(range!.from, range!.to)).toBe(
            'How are you?'
        );
    });

    it('returns null for a degenerate range', () => {
        expect(rangeToPos(utterance.segments, 5, 5)).toBeNull();
    });
});

describe('splitSentences', () => {
    it('splits on terminating punctuation and trims whitespace', () => {
        const text = 'Hello world. How are you? Fine!';
        const sentences = splitSentences(text);
        expect(sentences.map((s) => text.slice(s.start, s.end))).toEqual([
            'Hello world.',
            'How are you?',
            'Fine!'
        ]);
    });

    it('treats a newline as a sentence break', () => {
        const text = 'First line\nSecond line';
        const sentences = splitSentences(text);
        expect(sentences.map((s) => text.slice(s.start, s.end))).toEqual([
            'First line',
            'Second line'
        ]);
    });

    it('keeps a trailing fragment with no terminator', () => {
        const sentences = splitSentences('Just a fragment');
        expect(sentences).toEqual([{ start: 0, end: 15 }]);
    });
});

describe('chunkUtterance', () => {
    it('emits one chunk per sentence, with global start offsets', () => {
        const utterance = buildUtterance(
            twoParagraphs,
            0,
            twoParagraphs.content.size
        );
        const chunks = chunkUtterance(utterance);

        expect(chunks.map((c) => c.text)).toEqual([
            'Hello world.',
            'How are you?',
            'Fine.'
        ]);
        // Each chunk's startOffset indexes back into the full utterance string.
        for (const chunk of chunks) {
            expect(
                utterance.text.slice(
                    chunk.startOffset,
                    chunk.startOffset + chunk.text.length
                )
            ).toBe(chunk.text);
        }
    });

    it('carries the sentence range so it can be highlighted without boundary events', () => {
        const utterance = buildUtterance(
            twoParagraphs,
            0,
            twoParagraphs.content.size
        );
        const [first] = chunkUtterance(utterance);
        expect(first.sentence).not.toBeNull();
        expect(
            twoParagraphs.textBetween(first.sentence!.from, first.sentence!.to)
        ).toBe('Hello world.');
    });

    it('keeps a whole sentence in one chunk when it fits', () => {
        const sentence = doc({
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        {
                            type: 'text',
                            text: 'The quick brown fox jumped over it, which surprised everyone nearby.'
                        }
                    ]
                }
            ]
        });
        const utterance = buildUtterance(sentence, 0, sentence.content.size);
        // Commas are not chunk boundaries — only sentence ends and the length cap are.
        expect(chunkUtterance(utterance).map((c) => c.text)).toEqual([
            'The quick brown fox jumped over it, which surprised everyone nearby.'
        ]);
    });

    it('splits a long sentence at whitespace, never mid-word', () => {
        const long = doc({
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        {
                            type: 'text',
                            text: `${'alpha bravo '.repeat(20)}end.`
                        }
                    ]
                }
            ]
        });
        const utterance = buildUtterance(long, 0, long.content.size);
        const chunks = chunkUtterance(utterance, 40);

        expect(chunks.length).toBeGreaterThan(1);
        for (const chunk of chunks) {
            expect(chunk.text.length).toBeLessThanOrEqual(40);
            // No chunk starts or ends part-way through a word.
            expect(chunk.text).toBe(chunk.text.trim());
            expect(chunk.text).toMatch(/^(alpha|bravo|end\.)/);
        }
        // Every sub-chunk of the one long sentence shares its sentence range.
        const ranges = new Set(chunks.map((c) => JSON.stringify(c.sentence)));
        expect(ranges.size).toBe(1);
    });

    it('breaks a just-over-cap sentence at a clause, not before the last word', () => {
        // 183 chars — barely over the cap. Breaking as late as the budget allows put
        // the split between "with" and "challenges.", an audible pause mid-phrase.
        const text =
            'Modern product teams operate in fast-moving, cross-functional environments where strategy, discovery, delivery, and go-to-market are deeply interconnected and fraught with challenges.';
        const sentence = doc({
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
        });
        const utterance = buildUtterance(sentence, 0, sentence.content.size);
        const chunks = chunkUtterance(utterance);

        expect(chunks).toHaveLength(2);
        // The break lands on a comma, and the two halves stay comparable in size.
        expect(chunks[0].text.endsWith(',')).toBe(true);
        expect(chunks[1].text.length).toBeGreaterThan(40);
        // Nothing is dropped: the chunks still spell out the sentence.
        expect(chunks.map((c) => c.text).join(' ')).toBe(text);
    });

    it('round-trips a chunk-relative offset to the right document position', () => {
        const utterance = buildUtterance(
            twoParagraphs,
            0,
            twoParagraphs.content.size
        );
        const chunks = chunkUtterance(utterance);
        // "are" sits at chunk-relative offset 4 of "How are you?" — the same shift a
        // boundary event's charIndex needs.
        const chunk = chunks[1];
        const charIndex = chunk.text.indexOf('are');
        const start = chunk.startOffset + charIndex;
        const range = rangeToPos(utterance.segments, start, start + 3);
        expect(twoParagraphs.textBetween(range!.from, range!.to)).toBe('are');
    });

    it('numbers sentences contiguously, sharing one index across sub-chunks', () => {
        const utterance = buildUtterance(mixed, 0, mixed.content.size);
        const chunks = chunkUtterance(utterance, 40);

        // Non-decreasing, starting at 0, and never skipping a number.
        expect(chunks[0].sentenceIndex).toBe(0);
        for (let i = 1; i < chunks.length; i += 1) {
            const step = chunks[i].sentenceIndex - chunks[i - 1].sentenceIndex;
            expect(step === 0 || step === 1).toBe(true);
        }
        // The long sentence really did span several chunks under one index.
        const first = chunks.filter((c) => c.sentenceIndex === 0);
        expect(first.length).toBeGreaterThan(1);
        expect(chunks.at(-1)!.sentenceIndex).toBe(2);
    });
});

describe('sentence navigation', () => {
    it('reports one start per sentence when each fits in a single chunk', () => {
        const utterance = buildUtterance(
            twoParagraphs,
            0,
            twoParagraphs.content.size
        );
        expect(sentenceStartIndices(chunkUtterance(utterance))).toEqual([
            0, 1, 2
        ]);
    });

    it('reports a single start for a sentence split across chunks', () => {
        const long = doc({
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        {
                            type: 'text',
                            text: `${'alpha bravo '.repeat(20)}end.`
                        }
                    ]
                }
            ]
        });
        const utterance = buildUtterance(long, 0, long.content.size);
        const chunks = chunkUtterance(utterance, 40);

        expect(chunks.length).toBeGreaterThan(1);
        // This is the whole point: skipping steps over all of it as one sentence.
        expect(sentenceStartIndices(chunks)).toEqual([0]);
    });

    it('finds the starts of a long sentence followed by short ones', () => {
        const utterance = buildUtterance(mixed, 0, mixed.content.size);
        const chunks = chunkUtterance(utterance, 40);
        const starts = sentenceStartIndices(chunks);

        expect(starts).toHaveLength(3);
        expect(starts[0]).toBe(0);
        // The two short sentences are the final two chunks.
        expect(starts[1]).toBe(chunks.length - 2);
        expect(starts[2]).toBe(chunks.length - 1);
    });

    it('reports no starts for an empty queue', () => {
        expect(sentenceStartIndices([])).toEqual([]);
    });

    it.each([
        ['mid-sentence resolves to that sentence', 4, 3],
        ['an exact start returns itself', 3, 3],
        ['before the first start clamps down', 0, 0],
        ['past the end clamps to the last', 99, 5]
    ])('sentenceStartAt: %s', (_name, index, expected) => {
        expect(sentenceStartAt([0, 3, 5], index)).toBe(expected);
    });

    it('sentenceStartAt returns 0 with no sentences', () => {
        expect(sentenceStartAt([], 4)).toBe(0);
    });

    it('nextSentenceStart finds the following sentence', () => {
        expect(nextSentenceStart([0, 3, 5], 4)).toBe(5);
        expect(nextSentenceStart([0, 3, 5], 0)).toBe(3);
    });

    it('nextSentenceStart returns null in the last sentence', () => {
        expect(nextSentenceStart([0, 3, 5], 6)).toBeNull();
        expect(nextSentenceStart([], 0)).toBeNull();
    });

    it('skipBackTarget restarts the current sentence when asked', () => {
        expect(skipBackTarget([0, 3, 5], 4, true)).toBe(3);
    });

    it('skipBackTarget steps back a whole sentence otherwise', () => {
        expect(skipBackTarget([0, 3, 5], 4, false)).toBe(0);
    });

    it('skipBackTarget never goes below the first sentence', () => {
        expect(skipBackTarget([0, 3], 1, false)).toBe(0);
        expect(skipBackTarget([0, 3], 0, false)).toBe(0);
    });

    it('skipBackTarget steps to the previous sentence, not an earlier chunk', () => {
        // Index 7 is mid-way through a multi-chunk sentence starting at 5. Stepping
        // back must land on the previous *sentence* (0), not chunk 5 or 6.
        expect(skipBackTarget([0, 5], 7, false)).toBe(0);
    });
});
