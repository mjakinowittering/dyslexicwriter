import { describe, expect, it } from 'vitest';

import {
    fileNameFor,
    nextUntitledName,
    sanitiseTitle,
    UNTITLED
} from './document.model';

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
