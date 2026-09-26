import { describe, expect, it } from 'vitest';

import { formatFileSize } from '$lib/utils/file-size';

// Decimal units, rounded up: every boundary below is one byte either side of a
// thousand, where a binary unit or a rounding-down would show a different number
// to the writer's own file manager.
describe('formatFileSize', () => {
    it.each([
        [0, 'Empty'],
        [1, '1 KB'],
        [999, '1 KB'],
        [1_000, '1 KB'],
        [1_001, '2 KB'],
        [999_999, '1.0 MB'],
        [1_000_000, '1.0 MB'],
        [1_450_000, '1.5 MB']
    ])('%i bytes reads as %s', (bytes, expected) => {
        expect(formatFileSize(bytes)).toBe(expected);
    });
});
