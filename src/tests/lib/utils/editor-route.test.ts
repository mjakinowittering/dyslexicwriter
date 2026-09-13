import { describe, expect, it } from 'vitest';

import { editorRoute } from '$lib/utils/editor-route';

// The editor reopens whatever `?doc=` says on a reload, so what goes in has to
// come back out of `searchParams.get('doc')` exactly — a character lost to the
// query string is a document the reload cannot find.
function docParam(route: string): string | null {
    return new URL(route, 'http://localhost').searchParams.get('doc');
}

describe('editorRoute', () => {
    it('is bare /edit for a document with no file yet', () => {
        expect(editorRoute(null)).toBe('/edit');
    });

    it('round-trips a nested path through the query string', () => {
        expect(docParam(editorRoute('Book/Chapters/One.md'))).toBe(
            'Book/Chapters/One.md'
        );
    });

    it('round-trips the characters a query string would otherwise eat', () => {
        const path = 'Notes & Ideas/Draft #2? 100% + more.md';
        expect(docParam(editorRoute(path))).toBe(path);
    });
});
