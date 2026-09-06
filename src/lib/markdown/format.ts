import markdownPlugin from 'prettier/plugins/markdown';
import * as prettier from 'prettier/standalone';

import type { PrettierPreferences } from '$lib/models/prettier.model';

// Tidy the derived markdown before it lands on disk. Runs between `toMarkdown` and
// `joinFrontmatter`, which is the only seam where all three of these hold:
//
//   - the markdown exists, so there is something to format
//   - the frontmatter is not yet attached, so Prettier's YAML printer never sees
//     it and the deliberate JSON_SCHEMA / lineWidth choices in frontmatter.ts
//     survive untouched
//   - the writable is not yet open, so a throw here cannot truncate the user's
//     chapter — see the contract on `writeFile` in fs/io.ts
//
// Why this is worth doing at all: turndown's output parses fine but reads badly
// anywhere else — `-   One` with three spaces, `* * *` for a thematic break,
// unpadded table pipes, and a paragraph on one unbounded line however long the
// sentence runs. Prettier normalises all of it, and `proseWrap: 'always'` is what
// wraps the prose. `printWidth` on its own does nothing to a paragraph: Prettier's
// default `proseWrap: 'preserve'` leaves every existing line break exactly where it
// is, so both keys are stored and both are load-bearing.
//
// Hard wrapping cannot corrupt a document. The hazard would be a `1.`, `-`, `#`,
// `>` or `+` pushed to column 0 by a break and re-parsing as markup on the way back
// in — Prettier guards it by moving the break earlier instead, and the round-trip
// suite pins the behaviour rather than trusting it.
export async function formatMarkdown(
    body: string,
    prefs: PrettierPreferences
): Promise<string> {
    // Prettier answers a blank document with a lone newline; an empty file is what
    // an empty document has always written, and `createDocument` depends on it.
    if (body.trim().length === 0) return body;

    const formatted = await prettier.format(body, {
        parser: 'markdown',
        plugins: [markdownPlugin],
        printWidth: prefs.printWidth,
        proseWrap: prefs.proseWrap
    });

    // `toMarkdown` returns trimmed output and `joinFrontmatter` owns the trailing
    // newline, so trimming here keeps this a drop-in for the string it replaces.
    return formatted.trimEnd();
}

// The worker port's contract, declared here because both sides import it: the
// worker to answer, the client to ask. `id` correlates a reply with its request —
// several saves can be in flight across documents.
export interface FormatRequest {
    id: number;
    body: string;
    prefs: PrettierPreferences;
}

export type FormatResponse =
    | { id: number; body: string }
    | { id: number; error: string };
