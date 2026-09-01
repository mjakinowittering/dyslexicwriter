import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

// Pure helpers that turn a ProseMirror document range into the plain string handed
// to the Web Speech API, plus the machinery to translate a `boundary` event's
// character offset back into ProseMirror positions (so a word/sentence can be
// highlighted). No DOM access here — this module is unit-tested in isolation.

// A contiguous run of text from a single ProseMirror text node.
export interface OffsetSegment {
    // Offset of this run's first character within the utterance string.
    textStart: number;
    // ProseMirror position of this run's first character.
    pmStart: number;
    // Number of characters in the run.
    length: number;
}

export interface Utterance {
    text: string;
    segments: OffsetSegment[];
}

export interface Range {
    from: number;
    to: number;
}

export interface SentenceRange {
    start: number;
    end: number;
}

// Inserted between blocks so sentence/word splitting doesn't run the last word of
// one paragraph into the first word of the next. It occupies an offset with no
// segment mapping — offsets that land on it snap to the nearest real text position.
const BLOCK_SEPARATOR = '\n';

// Build the utterance string for `doc` between positions `from` and `to`, recording
// a segment per text run so offsets can be mapped back to positions. Pass the whole
// document (`from = 0`, `to = doc.content.size`) or a selection range.
export function buildUtterance(
    doc: ProseMirrorNode,
    from: number,
    to: number
): Utterance {
    const segments: OffsetSegment[] = [];
    let text = '';

    doc.nodesBetween(from, to, (node, pos) => {
        if (node.isText && node.text) {
            // Clip to [from, to] — a selection may start or end mid-text-node.
            const nodeFrom = Math.max(pos, from);
            const nodeTo = Math.min(pos + node.text.length, to);
            if (nodeTo <= nodeFrom) return true;
            const slice = node.text.slice(nodeFrom - pos, nodeTo - pos);
            segments.push({
                textStart: text.length,
                pmStart: nodeFrom,
                length: slice.length
            });
            text += slice;
        } else if (
            node.isBlock &&
            text.length > 0 &&
            !text.endsWith(BLOCK_SEPARATOR)
        ) {
            // Entering a new block after some text — separate them.
            text += BLOCK_SEPARATOR;
        }
        return true;
    });

    return { text, segments };
}

// Position at the left edge of the character at `offset`. If `offset` falls in a
// separator gap, snaps forward to the next real text position (used for a start).
function posForStart(segments: OffsetSegment[], offset: number): number | null {
    for (const seg of segments) {
        if (offset < seg.textStart) return seg.pmStart;
        if (offset < seg.textStart + seg.length) {
            return seg.pmStart + (offset - seg.textStart);
        }
    }
    const last = segments.at(-1);
    return last ? last.pmStart + last.length : null;
}

// Position just past the character ending at `offset`. If `offset` falls in a
// separator gap, snaps back to the previous real text position (used for an end).
function posForEnd(segments: OffsetSegment[], offset: number): number | null {
    let prevEnd: number | null = null;
    for (const seg of segments) {
        const segEndOffset = seg.textStart + seg.length;
        if (offset <= seg.textStart) return prevEnd;
        if (offset <= segEndOffset)
            return seg.pmStart + (offset - seg.textStart);
        prevEnd = seg.pmStart + seg.length;
    }
    return prevEnd;
}

// Map a `[start, end)` character range in the utterance to a ProseMirror range.
// Returns null when the range can't be resolved (empty doc, degenerate range).
export function rangeToPos(
    segments: OffsetSegment[],
    start: number,
    end: number
): Range | null {
    const from = posForStart(segments, start);
    const to = posForEnd(segments, end);
    if (from == null || to == null || to <= from) return null;
    return { from, to };
}

// Split text into sentence ranges (char offsets). A sentence runs up to and
// including its terminating punctuation (. ! ?); newlines also end a sentence.
// Leading/trailing whitespace is trimmed so a highlight starts and ends on a word.
//
// A terminator only ends a sentence when whitespace or the end of the text follows
// it — optionally through a closing quote or bracket. Ending on any `.` at all
// split filenames (`diagram.png`), decimals (`1.5`) and version numbers mid-word,
// which is audible as well as visible: chunkUtterance builds the playback queue
// from these ranges, so each fragment became its own utterance. Abbreviations
// (`e.g.`, `Mr.`) still split — that needs a word list, not a regex.
export function splitSentences(text: string): SentenceRange[] {
    const ranges: SentenceRange[] = [];
    const re = /[^\n]*?[.!?]+["'”’)\]}]*(?=\s|$)|[^\n]+/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
        const raw = match[0];
        if (raw.length === 0) {
            re.lastIndex += 1; // guard against a zero-width match stalling the loop
            continue;
        }
        const leading = raw.length - raw.trimStart().length;
        const start = match.index + leading;
        const end = match.index + raw.trimEnd().length;
        if (end > start) ranges.push({ start, end });
    }
    return ranges;
}

// One unit of speech — a single `SpeechSynthesisUtterance`.
export interface Chunk {
    // The text spoken for this chunk.
    text: string;
    // Offset of this chunk's first character in the full utterance string. Boundary
    // events report a charIndex relative to the chunk, so add this to go global.
    startOffset: number;
    // The document range of the sentence this chunk belongs to — highlighted for the
    // chunk's whole duration. A long sentence split across chunks keeps one range.
    sentence: Range | null;
    // Which sentence this chunk belongs to, counting from 0. Sub-chunks of one
    // sentence share a value — this is what lets the skip controls step by sentence
    // rather than by chunk, without comparing `sentence` by object identity (which
    // breaks on a null range).
    sentenceIndex: number;
}

// Hard cap on a chunk's length. Browsers silently drop utterances that are too long
// (a whole document never starts speaking) and Chrome cuts playback off around 15s —
// so text is spoken as a queue of chunks, one utterance each.
//
// The cap is characters but the limit it guards is *time*, so it has to hold at the
// slowest reading speed the app offers. At TTS_RATE_MIN this is roughly 14s of
// speech; at 1x, about 10s. The previous 180 was comfortably over the cutoff at
// anything below 1x, which is exactly where a dyslexic writer sets it.
export const MAX_CHUNK_CHARS = 140;

// Punctuation a reader already pauses on. The gap between two utterances is audible,
// so an over-long sentence is broken here where possible — the pause then sounds
// intentional instead of landing mid-phrase.
const CLAUSE_END = /[,;:)\]—–]/;

// Pick where to end a chunk inside an over-long sentence. Candidates are word gaps
// in `[lo, hi]` (so a word is never split); a clause boundary beats a plain space,
// and among equals the one nearest `target` wins. Falls back to a hard cut at `hi`
// for an unbroken run.
function findBreak(
    text: string,
    lo: number,
    hi: number,
    target: number
): number {
    let clause = -1;
    let space = -1;
    const nearer = (candidate: number, best: number): boolean =>
        best < 0 || Math.abs(candidate - target) < Math.abs(best - target);

    for (let i = lo; i <= hi; i += 1) {
        if (!/\s/.test(text[i] ?? '')) continue;
        if (CLAUSE_END.test(text[i - 1] ?? '') && nearer(i, clause)) clause = i;
        if (nearer(i, space)) space = i;
    }

    if (clause >= 0) return clause;
    return space >= 0 ? space : hi;
}

// Split an utterance into sentence-sized chunks, spoken sequentially as their own
// utterances.
//
// This exists purely to satisfy the browser's utterance limits (see MAX_CHUNK_CHARS);
// it is NOT a highlight mechanism. Each chunk's `onstart` drives the (exact) sentence
// highlight; word highlight, when available, comes from real `boundary` events. A
// sentence longer than the cap is sub-split at whitespace (never mid-word); every
// sub-chunk carries the whole sentence's range so the sentence highlight stays put.
export function chunkUtterance(
    utterance: Utterance,
    maxChars: number = MAX_CHUNK_CHARS
): Chunk[] {
    const chunks: Chunk[] = [];
    let sentenceIndex = 0;

    for (const sentence of splitSentences(utterance.text)) {
        const range = rangeToPos(
            utterance.segments,
            sentence.start,
            sentence.end
        );
        const before = chunks.length;

        let cursor = sentence.start;
        while (cursor < sentence.end) {
            const remaining = sentence.end - cursor;
            let end: number;
            if (remaining <= maxChars) {
                end = sentence.end;
            } else {
                // Spread what's left over evenly sized chunks and aim each break at a
                // natural pause. Breaking as late as the budget allows would strand a
                // word or two in a final chunk — a very audible gap right before it.
                const parts = Math.ceil(remaining / maxChars);
                end = findBreak(
                    utterance.text,
                    cursor + Math.max(1, Math.floor(maxChars / 2)),
                    cursor + maxChars,
                    cursor + Math.ceil(remaining / parts)
                );
            }

            const text = utterance.text.slice(cursor, end).trim();
            if (text.length > 0) {
                const lead = utterance.text.slice(cursor, end).indexOf(text[0]);
                chunks.push({
                    text,
                    startOffset: cursor + Math.max(0, lead),
                    sentence: range,
                    sentenceIndex
                });
            }

            cursor = end;
            // Skip the whitespace we broke on so the next chunk starts on a word.
            while (cursor < sentence.end && /\s/.test(utterance.text[cursor])) {
                cursor += 1;
            }
        }

        // Only advance on a sentence that actually produced speech, so the indices
        // stay contiguous even if a sentence trims away to nothing.
        if (chunks.length > before) sentenceIndex += 1;
    }

    return chunks;
}

// ── Sentence navigation ──────────────────────────────────────────────────────────
//
// The skip controls move by sentence, but the playback queue is chunks — and a
// sentence over MAX_CHUNK_CHARS spans several of them. These helpers reduce a
// Chunk[] to the indices where each sentence begins, which is all the controls
// need. Deliberately numbers in, numbers out: the controller can hold the result as
// reactive state without proxying the chunks themselves (whose `sentence` ranges go
// straight into ProseMirror decorations).

// Indices of the first chunk of each sentence, ascending.
export function sentenceStartIndices(chunks: Chunk[]): number[] {
    const starts: number[] = [];
    for (let i = 0; i < chunks.length; i += 1) {
        if (
            i === 0 ||
            chunks[i].sentenceIndex !== chunks[i - 1].sentenceIndex
        ) {
            starts.push(i);
        }
    }
    return starts;
}

// First chunk of the sentence containing `index`. Clamps an out-of-range index;
// returns 0 when there are no sentences.
export function sentenceStartAt(starts: number[], index: number): number {
    let start = starts[0] ?? 0;
    for (const candidate of starts) {
        if (candidate > index) break;
        start = candidate;
    }
    return start;
}

// First chunk of the next sentence, or null when `index` is already in the last one.
export function nextSentenceStart(
    starts: number[],
    index: number
): number | null {
    return starts.find((start) => start > index) ?? null;
}

// Media-player skip-back: restart the current sentence when playback is already into
// it, otherwise step back one. On the first sentence both cases restart it, so this
// never returns a negative index.
export function skipBackTarget(
    starts: number[],
    index: number,
    restartCurrent: boolean
): number {
    const current = sentenceStartAt(starts, index);
    if (restartCurrent) return current;
    const at = starts.indexOf(current);
    return at > 0 ? starts[at - 1] : current;
}
