import { dump, JSON_SCHEMA, load } from 'js-yaml';

// YAML frontmatter — the `---` fenced block that Obsidian, Hugo, Jekyll and most
// static-site tools put at the top of a markdown file.
//
// The editor knows nothing about it and must not: marked parses the opening `---`
// as a thematic break and the closing one as a setext underline, so left in the
// body it comes back as a heading full of the user's metadata. Instead it is split
// off on read, carried alongside the document while it is open, and reattached to
// the derived markdown on write.
//
// Preservation only. Nothing in the app reads these values — a `title:` key must
// never start competing with the folder name, which is the one title authority.
//
// The fence is matched here rather than by gray-matter, which cannot run in a
// browser at all: it calls Node's `Buffer.from` on every parse and every write.

export type Frontmatter = Record<string, unknown>;

export interface SplitFile {
    frontmatter: Frontmatter | null;
    body: string;
}

// An opening `---` on the very first line, and the next line that is nothing but
// `---`. Everything between is the block; everything after is the document. CRLF
// is tolerated because the file may have been written on Windows.
const FENCE = /^---[ \t]*\r?\n([\s\S]*?)(?:\r?\n)?^---[ \t]*(?:\r?\n|$)/m;

// js-yaml's older default schema turns a bare `2026-08-14` into a JS Date, which
// writes back as a full ISO timestamp, and its default dump quotes it — either way
// a change to the meaning of the user's file rather than its appearance.
// JSON_SCHEMA keeps scalars as written in both directions. `lineWidth: -1` stops
// long values being folded across lines on write-back.
const YAML_OPTIONS = { schema: JSON_SCHEMA } as const;
const DUMP_OPTIONS = { schema: JSON_SCHEMA, lineWidth: -1 } as const;

// YAML's top level can be a sequence or a bare scalar as easily as a mapping, and
// the file is user-editable, so its shape is never assumed.
function isFrontmatter(value: unknown): value is Frontmatter {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Separate a file's frontmatter from the markdown under it. A file with no
// frontmatter — or with something that is not a mapping of keys — comes back
// whole, exactly as the app treated every file before this existed. Nothing is
// ever dropped on the floor.
export function splitFrontmatter(raw: string): SplitFile {
    const match = FENCE.exec(raw);
    if (!match || match.index !== 0) return { frontmatter: null, body: raw };

    let parsed: unknown;
    try {
        parsed = load(match[1], YAML_OPTIONS);
    } catch {
        // Malformed YAML throws, and this is the document-open path: a typo in
        // someone's frontmatter must never make their document unopenable. Fall
        // back to treating the whole file as body.
        return { frontmatter: null, body: raw };
    }

    if (!isFrontmatter(parsed) || Object.keys(parsed).length === 0) {
        return { frontmatter: null, body: raw };
    }

    return { frontmatter: parsed, body: raw.slice(match[0].length) };
}

// The inverse: put the frontmatter back on top of the derived markdown. A document
// that never had frontmatter must not gain an empty fence on its first save, so
// `null` returns the body untouched.
export function joinFrontmatter(
    frontmatter: Frontmatter | null,
    body: string
): string {
    if (!frontmatter || Object.keys(frontmatter).length === 0) return body;

    // dump() already ends in a newline, hence only one more before the body — the
    // blank line every other tool leaves between the fence and the prose.
    const block = `---\n${dump(frontmatter, DUMP_OPTIONS)}---\n`;

    return body.length > 0 ? `${block}\n${body}\n` : block;
}
