import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import { tooltips } from '$lib/stores/tooltips.svelte';

import Harness from './TooltipTestHarness.svelte';

// Suppression has two halves, because a balloon inside a page that is transitioning out
// cannot be unmounted: Svelte pauses that subtree's effects, so bits-ui never removes the
// node it has already closed. Half one is the project Tooltip root (close + refuse to
// re-open); half two is the <body> attribute that the rule in layout.css hides from, set
// from outside the paused subtree.
describe('Tooltip suppression', () => {
    // Release the hold so a long-suppressing test can't bleed into the next one.
    afterEach(async () => {
        tooltips.suppress(0);
        await vi.waitFor(() => expect(tooltips.suppressed).toBe(false));
    });

    it('closes an open balloon, and refuses to re-open, while suppressed', async () => {
        render(Harness);

        const trigger = page.getByRole('button', { name: 'trigger' });
        await trigger.hover();
        await expect.element(page.getByText('the balloon')).toBeVisible();

        tooltips.suppress(1000);
        await expect
            .element(page.getByText('the balloon'))
            .not.toBeInTheDocument();

        // Still suppressed: hovering away and back must not bring it back.
        await page.getByText('elsewhere').hover();
        await trigger.hover();
        await expect
            .element(page.getByText('the balloon'))
            .not.toBeInTheDocument();
    });

    it('flags <body> so the stylesheet can hide a balloon that cannot be unmounted', async () => {
        render(Harness);
        expect(document.body.hasAttribute('data-tooltips-suppressed')).toBe(
            false
        );

        tooltips.suppress(1000);
        await vi.waitFor(() =>
            expect(document.body.hasAttribute('data-tooltips-suppressed')).toBe(
                true
            )
        );
    });
});
