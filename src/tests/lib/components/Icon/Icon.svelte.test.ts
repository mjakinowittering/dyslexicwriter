import { ArrowDown01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';

import Icon from '$lib/components/Icon/Icon.svelte';

// Hugeicons builds the <svg>'s children imperatively from the icon data it is
// handed on mount and never looks at that prop again, so an icon that swaps
// with state — the Files tree's disclosure arrow — kept drawing whichever glyph
// it started with. Icon keys on the data to force a remount; this is the guard.
const drawn = (container: HTMLElement): string =>
    container.querySelector('svg path')?.getAttribute('d') ?? '';

describe('Icon', () => {
    it('redraws when the icon data changes', async () => {
        const { container, rerender } = await render(Icon, {
            icon: ArrowRight01Icon
        });

        const closed = drawn(container);
        expect(closed).toBe(ArrowRight01Icon[0][1].d);

        await rerender({ icon: ArrowDown01Icon });
        expect(drawn(container)).toBe(ArrowDown01Icon[0][1].d);
    });
});
