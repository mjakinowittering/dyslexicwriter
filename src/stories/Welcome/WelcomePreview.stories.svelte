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
                        'The picture of the editor on the welcome screen, so a first-time visitor can see what the app does before handing over a folder. A **static mock**, never a live TipTap instance — a real editor here would be a second document with nowhere to save it. Decorative in full: `aria-hidden` on the root and nothing focusable inside, because a fake close button that takes a tab stop is worse than no preview at all. Drawn a step down from the editor’s real chrome on Tailwind’s own scale rather than scaled with a transform. **Full width, and as tall as its contents** — no aspect ratio and no height of its own: the window takes the column’s width, the well is as deep as the page inside it, and a screen with no room for all of that scrolls. It is shown or hidden, never resized, which is why the whole toolbar is always drawn. The sheet’s foot sits under the status bar, so the page has no visible bottom edge — it carries on the way a real one does. Hidden below `lg`, where the column is too narrow for the toolbar and the two cards are the whole job.'
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
        <!-- Only width is given: the preview brings its own height. The
             viewport has to clear `lg` for it to render at all — below that it
             hides itself, as it does on the welcome screen. -->
        <div class="bg-background w-full p-6">
            <WelcomePreview />
        </div>
    {/snippet}
</Story>
