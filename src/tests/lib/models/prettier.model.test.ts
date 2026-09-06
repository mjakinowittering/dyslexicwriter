import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
    configSchema,
    defaultConfig,
    parseConfig
} from '$lib/models/config.model';
import {
    prettierPreferencesSchema,
    PRINT_WIDTH_DEFAULT,
    PRINT_WIDTH_MAX,
    PRINT_WIDTH_MIN,
    proseWrapValues
} from '$lib/models/prettier.model';

describe('prettierPreferencesSchema', () => {
    it('accepts a valid preference object', () => {
        expect(
            v.safeParse(prettierPreferencesSchema, {
                printWidth: 80,
                proseWrap: 'always'
            }).success
        ).toBe(true);
    });

    it.each(proseWrapValues)('accepts the %s wrap mode', (proseWrap) => {
        expect(
            v.safeParse(prettierPreferencesSchema, {
                printWidth: PRINT_WIDTH_DEFAULT,
                proseWrap
            }).success
        ).toBe(true);
    });

    it('rejects a wrap mode Prettier does not have', () => {
        expect(
            v.safeParse(prettierPreferencesSchema, {
                printWidth: PRINT_WIDTH_DEFAULT,
                proseWrap: 'sometimes'
            }).success
        ).toBe(false);
    });

    it('accepts the width bounds but rejects values outside them', () => {
        const at = (printWidth: number) =>
            v.safeParse(prettierPreferencesSchema, {
                printWidth,
                proseWrap: 'always'
            }).success;

        expect(at(PRINT_WIDTH_MIN)).toBe(true);
        expect(at(PRINT_WIDTH_MAX)).toBe(true);
        expect(at(PRINT_WIDTH_MIN - 1)).toBe(false);
        expect(at(PRINT_WIDTH_MAX + 1)).toBe(false);
    });

    // A fractional column has no meaning, and Prettier would floor it silently.
    it('rejects a non-integer width', () => {
        expect(
            v.safeParse(prettierPreferencesSchema, {
                printWidth: 80.5,
                proseWrap: 'always'
            }).success
        ).toBe(false);
    });
});

describe('configSchema — formatting preferences on disk', () => {
    it('accepts a config carrying valid formatting preferences', () => {
        expect(
            v.safeParse(configSchema, {
                ...defaultConfig(),
                prettier: { printWidth: 100, proseWrap: 'preserve' }
            }).success
        ).toBe(true);
    });

    it('rejects a config with an out-of-range width', () => {
        expect(
            v.safeParse(configSchema, {
                ...defaultConfig(),
                prettier: { printWidth: 0, proseWrap: 'always' }
            }).success
        ).toBe(false);
    });

    // config.json is hand-editable, so a bad width must degrade to the default
    // rather than throw — the user's writing must stay reachable.
    it('falls back to defaults rather than throwing on an invalid width', () => {
        const parsed = parseConfig({
            ...defaultConfig(),
            prettier: { printWidth: -10, proseWrap: 'always' }
        });

        expect(parsed.prettier.printWidth).toBe(PRINT_WIDTH_DEFAULT);
    });
});
