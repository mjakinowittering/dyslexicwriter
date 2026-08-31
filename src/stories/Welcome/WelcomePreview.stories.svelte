<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import WelcomePreview from '$lib/components/Welcome/WelcomePreview.svelte';

    const { Story } = defineMeta({
        title: 'Welcome/WelcomePreview',
        component: WelcomePreview,
        tags: ['autodocs'],
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The picture of the editor on the welcome screen, so a first-time visitor can see what the app does before handing over a folder. A **static mock**, never a live TipTap instance — a real editor here would be a second document with nowhere to save it. Decorative in full: `aria-hidden` on the root and nothing focusable inside, because a fake close button that takes a tab stop is worse than no preview at all. Drawn a step down from the editor’s real chrome on Tailwind’s own scale rather than scaled with a transform. It keeps a screen’s shape (`aspect-video`) at every size, taking its width from the height it is given, and the A4 sheet inside it is clipped rather than ended — sliding under the status bar the way the top of a real page does. The toolbar groups reveal against the **window’s** own width, not the viewport’s, since the mock is routinely far narrower than the screen it is drawn on. Hidden below `sm`, where there is no width for it to read as anything.'
                }
            }
        }
    });
</script>

<!-- The window is aria-hidden, so nothing in it is reachable by role or text —
     which is the assertion worth making. -->
<Story
    name="Default"
    play={async ({ canvas }) => {
        // Role queries honour aria-hidden, which is exactly the fence being
        // tested: the mocked controls must not be reachable, and the sample
        // document's heading must not be announced. A text query would find
        // both — it ignores aria-hidden — so it is the wrong assertion here.
        await expect(canvas.queryAllByRole('button')).toHaveLength(0);
        await expect(canvas.queryAllByRole('heading')).toHaveLength(0);
    }}
>
    {#snippet template()}
        <!-- A bounded height, because the preview takes the one it is given —
             on the welcome screen that is whatever the cards above it leave. -->
        <div class="bg-background flex h-128 w-full justify-center p-6">
            <WelcomePreview />
        </div>
    {/snippet}
</Story>
