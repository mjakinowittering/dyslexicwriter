import { describe, expect, it } from 'vitest';

import * as markdown from '$lib/markdown';

// What `$lib/markdown` is allowed to hand out.
//
// `fs/documents.ts` imports this barrel, and CLAUDE.md requires `fs/` to stay
// free of any Prettier or worker import. The barrel used to re-export
// `formatMarkdown` and `markdownFormatter`, which put both in `fs/`'s module
// graph without a single line in `fs/` mentioning either — the kind of breach
// that is invisible at the call site and survives review.
//
// So the export list is pinned rather than trusted to the comment on the barrel.
// Asserted as the whole set, not as "the formatter is absent": a formatter
// re-exported under any other name would still be a formatter, and an addition
// here should be a decision somebody made on purpose rather than one that
// arrived with an unrelated change. Updating this list is the checkpoint.
const ALLOWED = [
    'documentExtensions',
    'emptyDocument',
    'fromMarkdown',
    'joinFrontmatter',
    'splitFrontmatter',
    'toMarkdown'
];

describe('the markdown barrel', () => {
    it('exports the document model and nothing else', () => {
        expect(Object.keys(markdown).sort()).toEqual(ALLOWED);
    });

    it('does not reach the formatter or its worker', () => {
        // The two names that were here, spelled out: the regression this file
        // exists for is specifically putting one of them back.
        expect(markdown).not.toHaveProperty('formatMarkdown');
        expect(markdown).not.toHaveProperty('markdownFormatter');
    });
});
