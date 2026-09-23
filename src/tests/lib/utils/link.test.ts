import { describe, expect, it } from 'vitest';

import { linkDomain, normaliseLinkHref } from '$lib/utils/link';

// These links land in files on disk and are opened from the editor, so the
// dialog refuses anything that is not plainly a web or email address.
describe('normaliseLinkHref', () => {
    it('keeps a web address exactly as written', () => {
        expect(normaliseLinkHref('https://example.com')).toBe(
            'https://example.com'
        );
        expect(normaliseLinkHref('http://example.com/a?b=c#d')).toBe(
            'http://example.com/a?b=c#d'
        );
    });

    it('accepts an email address', () => {
        expect(normaliseLinkHref('mailto:ada@example.com')).toBe(
            'mailto:ada@example.com'
        );
    });

    it('trims surrounding whitespace', () => {
        expect(normaliseLinkHref('  https://example.com \n')).toBe(
            'https://example.com'
        );
    });

    it('gives a bare www. address a scheme', () => {
        expect(normaliseLinkHref('www.example.com')).toBe(
            'https://www.example.com'
        );
        expect(normaliseLinkHref('WWW.example.com/page')).toBe(
            'https://WWW.example.com/page'
        );
    });

    it('accepts a scheme in capitals', () => {
        expect(normaliseLinkHref('HTTPS://example.com')).toBe(
            'HTTPS://example.com'
        );
    });

    it.each([
        ['javascript', 'javascript:alert(1)'],
        ['data', 'data:text/html,<script>alert(1)</script>'],
        ['vbscript', 'vbscript:msgbox(1)'],
        ['file', 'file:///etc/passwd'],
        ['ftp', 'ftp://example.com'],
        ['a relative path', 'notes.md'],
        ['an anchor', '#chapter-one'],
        ['a bare domain', 'example.com'],
        ['an email without mailto', 'ada@example.com'],
        ['mailto without an address', 'mailto:'],
        ['a scheme with no host', 'https://'],
        ['a space inside', 'https://example.com/a b'],
        ['nothing', '   ']
    ])('refuses %s', (_label, input) => {
        expect(normaliseLinkHref(input)).toBeNull();
    });
});

describe('linkDomain', () => {
    it('names the host of a web address', () => {
        expect(linkDomain('https://www.example.com/guide?x=1')).toBe(
            'www.example.com'
        );
    });

    it('names the domain of an email address', () => {
        expect(linkDomain('mailto:ada@example.com?subject=Hi')).toBe(
            'example.com'
        );
    });

    it('is empty for something it cannot read', () => {
        expect(linkDomain('notes.md')).toBe('');
        expect(linkDomain('mailto:nobody')).toBe('');
    });
});
