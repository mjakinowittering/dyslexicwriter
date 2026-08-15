<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, screen, userEvent, waitFor } from 'storybook/test';

    import * as Tooltip from '$lib/components/Tooltip';

    import { tooltipSuppression } from '$lib/actions/tooltip-suppression.svelte';
    import { tooltips } from '$lib/stores/tooltips.svelte';

    const { Story } = defineMeta({
        title: 'Tooltip/Tooltip',
        component: Tooltip.Root,
        tags: ['autodocs'],
        argTypes: {
            open: { control: 'boolean' }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The project’s tooltip root — the same API as the shadcn one, plus route-transition suppression. Import tooltips from `$lib/components/Tooltip`, never from `$lib/components/ui/tooltip`, which stays a pristine shim the shadcn CLI can re-add. Balloons are portaled to `<body>`, which is why suppression takes both a close and a `<body>` attribute for the stylesheet to hide from.'
                }
            }
        }
    });
</script>

<script lang="ts">
    // The balloon lands in <body>, outside the story's own element, so these
    // queries go through `screen` rather than the story canvas.
    const balloon = 'Save the document';
</script>

<svelte:body use:tooltipSuppression />

<Story
    name="Default"
    play={async () => {
        await userEvent.hover(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() =>
            expect(screen.getByText(balloon)).toBeInTheDocument()
        );
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Tooltip.Provider>
                <Tooltip.Root>
                    <Tooltip.Trigger>
                        {#snippet child({ props })}
                            <button {...props} aria-label="Save">Save</button>
                        {/snippet}
                    </Tooltip.Trigger>
                    <Tooltip.Content side="bottom">
                        <p>{balloon}</p>
                    </Tooltip.Content>
                </Tooltip.Root>
            </Tooltip.Provider>
        </div>
    {/snippet}
</Story>

<Story
    name="Suppressed"
    play={async () => {
        // What a navigating tooltipped control does: hold tooltips off, so a
        // balloon can't hang over the fading page.
        tooltips.suppress(1000);
        await waitFor(() =>
            expect(document.body.hasAttribute('data-tooltips-suppressed')).toBe(
                true
            )
        );

        await userEvent.hover(screen.getByRole('button', { name: 'Save' }));
        await expect(screen.queryByText(balloon)).not.toBeInTheDocument();

        // Release the hold so the next story starts from a clean page.
        tooltips.suppress(0);
        await waitFor(() => expect(tooltips.suppressed).toBe(false));
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Tooltip.Provider>
                <Tooltip.Root>
                    <Tooltip.Trigger>
                        {#snippet child({ props })}
                            <button {...props} aria-label="Save">Save</button>
                        {/snippet}
                    </Tooltip.Trigger>
                    <Tooltip.Content side="bottom">
                        <p>{balloon}</p>
                    </Tooltip.Content>
                </Tooltip.Root>
            </Tooltip.Provider>
        </div>
    {/snippet}
</Story>
