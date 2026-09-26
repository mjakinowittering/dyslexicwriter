import { describe, expect, it } from 'vitest';

import { filesRoute } from '$lib/utils/files-route';

// The Files screen reads `?reveal=` back with `searchParams.get`, so what goes in
// has to come out exactly — a character lost to the query string is a document
// the arrival cannot find.
function revealParam(route: string): string | null {
    return new URL(route, 'http://localhost').searchParams.get('reveal');
}

describe('filesRoute', () => {
    it('is bare / for the plain list', () => {
        expect(filesRoute(null)).toBe('/');
    });

    it('round-trips a nested path through the query string', () => {
        expect(revealParam(filesRoute('Book/Chapters/One.md'))).toBe(
            'Book/Chapters/One.md'
        );
    });

    it('round-trips the characters a query string would otherwise eat', () => {
        const path = 'Notes & Ideas/Draft #2? 100% + more.md';
        expect(revealParam(filesRoute(path))).toBe(path);
    });
});
