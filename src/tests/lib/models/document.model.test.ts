import { describe, expect, it } from 'vitest';

import {
    documentPath,
    fileNameFor,
    joinPath,
    lastSegment,
    nextUntitledName,
    parentPath,
    pathSegments,
    sanitiseTitle,
    titleFromFileName,
    UNTITLED
} from '$lib/models/document.model';

describe('sanitiseTitle', () => {
    it('leaves an ordinary title untouched', () => {
        expect(sanitiseTitle('My Chapter')).toBe('My Chapter');
    });

    it('preserves spaces, hyphens and unicode', () => {
        expect(sanitiseTitle('Chapter 2 - Café Notes')).toBe(
            'Chapter 2 - Café Notes'
        );
    });

    it.each([
        ['forward slashes', 'a/b', 'ab'],
        ['back slashes', 'a\\b', 'ab'],
        ['parent traversal', '../../etc/passwd', 'etcpasswd'],
        ['colons', 'a:b', 'ab'],
        ['wildcards', 'a*b?c', 'abc'],
        ['angle brackets', '<script>', 'script'],
        ['pipes', 'a|b', 'ab'],
        ['quotes', 'a"b', 'ab']
    ])('strips %s', (_label, input, expected) => {
        expect(sanitiseTitle(input)).toBe(expected);
    });

    it('strips control characters', () => {
        expect(sanitiseTitle('a\u0000b\u001fc')).toBe('abc');
    });

    it('strips leading dots so the folder is not hidden', () => {
        expect(sanitiseTitle('.hidden')).toBe('hidden');
    });

    it('strips trailing dots and spaces that Windows would drop silently', () => {
        expect(sanitiseTitle('Chapter. ')).toBe('Chapter');
    });

    it('falls back to Untitled when nothing usable remains', () => {
        expect(sanitiseTitle('///')).toBe(UNTITLED);
        expect(sanitiseTitle('   ')).toBe(UNTITLED);
    });

    it('suffixes Windows reserved device names', () => {
        expect(sanitiseTitle('CON')).toBe('CON_');
        expect(sanitiseTitle('com1')).toBe('com1_');
    });

    it('caps an over-long title', () => {
        expect(sanitiseTitle('x'.repeat(500))).toHaveLength(120);
    });
});

describe('fileNameFor', () => {
    it('appends the markdown extension to the sanitised title', () => {
        expect(fileNameFor('My Chapter')).toBe('My Chapter.md');
        expect(fileNameFor('a/b')).toBe('ab.md');
    });
});

describe('nextUntitledName', () => {
    it('uses the bare name when nothing is taken', () => {
        expect(nextUntitledName(new Set())).toBe('Untitled');
    });

    it('increments past a taken name', () => {
        expect(nextUntitledName(new Set(['Untitled']))).toBe('Untitled 2');
    });

    it('skips a run of taken names', () => {
        expect(
            nextUntitledName(new Set(['Untitled', 'Untitled 2', 'Untitled 3']))
        ).toBe('Untitled 4');
    });

    it('ignores gaps and returns the first free name', () => {
        expect(nextUntitledName(new Set(['Untitled', 'Untitled 3']))).toBe(
            'Untitled 2'
        );
    });
});

// A document's location is a '/'-joined path relative to the working folder, and
// '' is the working folder itself — the one place where an empty string is a
// valid answer rather than a missing one.
describe('path helpers', () => {
    it('splits a path into its segments, ignoring empties', () => {
        expect(pathSegments('Book/Chapters')).toEqual(['Book', 'Chapters']);
        expect(pathSegments('')).toEqual([]);
        expect(pathSegments('/Book//Chapters/')).toEqual(['Book', 'Chapters']);
    });

    it('joins parts, dropping the empty root', () => {
        expect(joinPath('Book', 'Chapters')).toBe('Book/Chapters');
        expect(joinPath('', 'notes')).toBe('notes');
        expect(joinPath('', '')).toBe('');
    });

    it('walks up to the parent, bottoming out at the root', () => {
        expect(parentPath('Book/Chapters/One')).toBe('Book/Chapters');
        expect(parentPath('Book')).toBe('');
        expect(parentPath('')).toBe('');
    });

    it('takes the last segment, or nothing at the root', () => {
        expect(lastSegment('Book/Chapters')).toBe('Chapters');
        expect(lastSegment('')).toBe('');
    });

    it('builds the path of a document, nested or loose', () => {
        expect(documentPath({ folder: 'Book/Chapters', file: 'One.md' })).toBe(
            'Book/Chapters/One.md'
        );
        expect(documentPath({ folder: '', file: 'notes.md' })).toBe('notes.md');
    });

    it('takes a title from a file name', () => {
        expect(titleFromFileName('My Chapter.md')).toBe('My Chapter');
        // A name with no extension is left as it is rather than truncated.
        expect(titleFromFileName('README')).toBe('README');
    });
});
