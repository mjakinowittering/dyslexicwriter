import { describe, expect, it } from 'vitest';

import { joinFrontmatter, splitFrontmatter } from '$lib/markdown/frontmatter';

// A `---` fence is metadata the writer put there deliberately, and the editor
// cannot represent it. Everything here is about it surviving a read and a write
// untouched — losing it is losing the user's work as surely as losing a paragraph.

const FENCED = [
    '---',
    'title: My Chapter',
    'author: Matthew',
    'date: 2026-08-14',
    'tags: [draft]',
    '---',
    '',
    '# Chapter One',
    '',
    'Some prose.'
].join('\n');

describe('splitFrontmatter', () => {
    it('separates the fence from the body', () => {
        const { frontmatter, body } = splitFrontmatter(FENCED);

        expect(frontmatter).toEqual({
            title: 'My Chapter',
            author: 'Matthew',
            date: '2026-08-14',
            tags: ['draft']
        });
        expect(body.trim()).toBe('# Chapter One\n\nSome prose.');
    });

    it('keeps a bare date as written rather than a timestamp', () => {
        const { frontmatter } = splitFrontmatter(FENCED);

        // js-yaml's default schema would hand back a JS Date here, which writes
        // out as 2026-08-14T00:00:00.000Z — a change to the meaning of the user's
        // file, not its appearance.
        expect(frontmatter?.date).toBe('2026-08-14');
    });

    it('leaves a file with no frontmatter whole', () => {
        const md = '# Just a document\n\nNo fence here.';

        expect(splitFrontmatter(md)).toEqual({
            frontmatter: null,
            body: md
        });
    });

    it('leaves a horizontal rule at the top of a file alone', () => {
        const md = '---\n\nA paragraph.\n\n---\n\nAnother.';

        expect(splitFrontmatter(md).frontmatter).toBeNull();
    });

    it('falls back to the whole file when the YAML is malformed', () => {
        // The document-open path: a typo in someone's frontmatter must never make
        // their document unopenable.
        const md = '---\ntitle: "unclosed\n---\n\nBody.';

        expect(splitFrontmatter(md)).toEqual({ frontmatter: null, body: md });
    });

    it('falls back for a fence that is not a mapping of keys', () => {
        const md = '---\n- one\n- two\n---\n\nBody.';

        expect(splitFrontmatter(md)).toEqual({ frontmatter: null, body: md });
    });

    it('keeps the frontmatter of a file that is nothing else', () => {
        const { frontmatter, body } = splitFrontmatter(
            '---\ntitle: Stub\n---\n'
        );

        expect(frontmatter).toEqual({ title: 'Stub' });
        expect(body.trim()).toBe('');
    });
});

describe('joinFrontmatter', () => {
    it('adds no fence to a document that never had one', () => {
        const body = '# Plain\n\nProse.';

        expect(joinFrontmatter(null, body)).toBe(body);
        expect(joinFrontmatter({}, body)).toBe(body);
    });

    it('writes the fence back above the body', () => {
        expect(joinFrontmatter({ title: 'Stub' }, '# Body')).toBe(
            '---\ntitle: Stub\n---\n\n# Body\n'
        );
    });

    it('keeps the fence when the body is empty', () => {
        expect(joinFrontmatter({ title: 'Stub' }, '')).toContain('title: Stub');
    });
});

describe('split then join', () => {
    it('preserves every key and value through a round-trip', () => {
        const { frontmatter, body } = splitFrontmatter(FENCED);
        const rejoined = joinFrontmatter(frontmatter, body.trim());

        expect(splitFrontmatter(rejoined).frontmatter).toEqual(frontmatter);
        expect(rejoined).toContain('date: 2026-08-14');
        expect(rejoined).toContain('# Chapter One');
    });

    it('is stable across repeated writes', () => {
        const { frontmatter, body } = splitFrontmatter(FENCED);
        const once = joinFrontmatter(frontmatter, body.trim());

        const second = splitFrontmatter(once);
        expect(joinFrontmatter(second.frontmatter, second.body.trim())).toBe(
            once
        );
    });
});
