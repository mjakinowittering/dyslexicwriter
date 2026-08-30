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
                        'The picture of the editor on the welcome screen, so a first-time visitor can see what the app does before handing over a folder. A **static mock**, never a live TipTap instance — a real editor here would be a second document with nowhere to save it. Decorative in full: `aria-hidden` on the root and nothing focusable inside, because a fake close button that takes a tab stop is worse than no preview at all. Drawn at 0.8 of the editor’s real geometry, written out rather than scaled with a transform. Hidden below `sm`, where there is no width for it to read as anything.'
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
        <div class="bg-background flex w-full justify-center p-6">
            <WelcomePreview />
        </div>
    {/snippet}
</Story>
