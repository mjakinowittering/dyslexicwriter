<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, screen, userEvent } from 'storybook/test';

    import PageBackToTop from '$lib/components/Editor/Page/PageBackToTop.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Page/PageBackToTop',
        component: PageBackToTop,
        tags: ['autodocs'],
        argTypes: {
            onclick: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The way back after read-aloud has followed the voice down a long document. `Page` floats it at the bottom-right of the canvas while a read is live and the canvas is scrolled past the first screen; clicking it ends the read and glides the page home — a read that carried on would only scroll back to the spoken sentence.'
                }
            }
        }
    });
</script>

<script lang="ts">
    const clicked = fn();
</script>

<Story
    name="Default"
    play={async ({ canvas }) => {
        const button = canvas.getByRole('button', {
            name: m.content_tts_back_to_top()
        });

        await userEvent.hover(button);
        await expect(
            await screen.findByText(m.content_tts_back_to_top_hint())
        ).toBeInTheDocument();

        await userEvent.click(button);
        await expect(clicked).toHaveBeenCalledOnce();
    }}
>
    {#snippet template()}
        <!-- On the canvas colour it actually floats over, so the shadow and the
             secondary fill can be judged against the right ground. -->
        <div
            class="bg-canvas flex min-h-96 w-full items-center justify-center p-6"
        >
            <PageBackToTop onclick={clicked} />
        </div>
    {/snippet}
</Story>
