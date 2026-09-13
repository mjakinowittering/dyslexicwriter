import { LinkSquare02Icon } from '@hugeicons/core-free-icons';
import { describe, expect, it } from 'vitest';

import { iconDataUri } from '$lib/utils/icon-data-uri';

function decode(uri: string): string {
    return decodeURIComponent(uri.replace('data:image/svg+xml,', ''));
}

describe('iconDataUri', () => {
    it('is an SVG data URI', () => {
        expect(iconDataUri(LinkSquare02Icon)).toMatch(/^data:image\/svg\+xml,/);
    });

    it('draws every part of the glyph', () => {
        const svg = decode(iconDataUri(LinkSquare02Icon));

        expect(svg.match(/<path /g)).toHaveLength(LinkSquare02Icon.length);
        for (const [, attributes] of LinkSquare02Icon) {
            expect(svg).toContain(String(attributes.d));
        }
    });

    // An SVG document reads `stroke-linecap`; the icon data spells it the JSX
    // way, and a React `key` is not an SVG attribute at all.
    it('writes SVG attribute names and drops the key', () => {
        const svg = decode(iconDataUri(LinkSquare02Icon));

        expect(svg).toContain('stroke-linecap="round"');
        expect(svg).toContain('stroke-width="1.5"');
        expect(svg).not.toContain('strokeLinecap');
        expect(svg).not.toContain('key=');
    });

    it('escapes a value that would end the attribute', () => {
        const svg = decode(
            iconDataUri([['path', { d: 'M0 0"/><script>', key: '0' }]])
        );

        expect(svg).toContain('d="M0 0&quot;/>&lt;script>"');
        expect(svg).not.toContain('<script>');
    });
});
