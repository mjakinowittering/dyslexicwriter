<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, screen, userEvent } from 'storybook/test';

    import type { LinkTarget } from '$lib/components/Editor/Link/link-target';
    import LinkCard from '$lib/components/Editor/Link/LinkCard.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Link/LinkCard',
        component: LinkCard,
        tags: ['autodocs'],
        args: {
            onEdit: fn(),
            onClose: fn()
        },
        argTypes: {
            target: { control: false },
            onEdit: { control: false },
            onClose: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'What a clicked link points at: its text, its domain and the full address, with **Edit** and **Open**. Shown on click only, anchored to the `<a>` in the editor, and it leaves focus in the writing. **Open** is a new tab with `rel="noopener noreferrer"`, and appears only for an address the link dialog would itself make — a relative link from a writer’s own files still shows where it points, but opening it would resolve against this app.'
                }
            }
        }
    });
</script>

<script lang="ts">
    import { onMount } from 'svelte';

    // The card anchors to a real element, so each story draws the link it
    // points at and hands the card that node once it exists.
    let webAnchor = $state<HTMLElement | null>(null);
    let relativeAnchor = $state<HTMLElement | null>(null);

    // The target arrives a frame after mount, the way a click would. bits-ui's
    // presence reads `open` when the Popover is created and then skips the
    // first run of its own watcher — so an `open` that turns true inside the
    // same mount pass (which `bind:this` on the link above would do) is never
    // seen, and the card never renders. The edit page is not exposed to this:
    // its card mounts with no target and gets one only when a link is clicked.
    let clicked = $state(false);
    onMount(() => {
        const frame = requestAnimationFrame(() => (clicked = true));
        return () => cancelAnimationFrame(frame);
    });

    const webTarget = $derived<LinkTarget | null>(
        clicked && webAnchor
            ? {
                  anchor: webAnchor,
                  href: 'https://example.com/guide/getting-started',
                  text: 'the guide'
              }
            : null
    );
    const relativeTarget = $derived<LinkTarget | null>(
        clicked && relativeAnchor
            ? { anchor: relativeAnchor, href: 'notes.md', text: 'my notes' }
            : null
    );
</script>

<Story
    name="Web link"
    play={async ({ args }) => {
        await expect(
            await screen.findByText('example.com')
        ).toBeInTheDocument();
        await expect(
            screen.getByText('https://example.com/guide/getting-started')
        ).toBeInTheDocument();

        const open = screen.getByRole('link', { name: m.content_link_open() });
        await expect(open).toHaveAttribute(
            'href',
            'https://example.com/guide/getting-started'
        );
        await expect(open).toHaveAttribute('target', '_blank');
        await expect(open).toHaveAttribute('rel', 'noopener noreferrer');

        await userEvent.click(
            screen.getByRole('button', { name: m.content_link_edit() })
        );
        await expect(args.onEdit).toHaveBeenCalledOnce();
    }}
>
    {#snippet template(args)}
        <div class="bg-background min-h-96 w-full p-6">
            <p class="text-foreground">
                Start with
                <a
                    bind:this={webAnchor}
                    class="text-primary underline"
                    href="https://example.com/guide/getting-started"
                    >the guide</a
                >.
            </p>
            <LinkCard {...args} target={webTarget} />
        </div>
    {/snippet}
</Story>

<Story
    name="Relative link"
    play={async () => {
        await expect(await screen.findByText('notes.md')).toBeInTheDocument();
        // Nothing to open from here: it would resolve against the app's URL.
        await expect(
            screen.queryByRole('link', { name: m.content_link_open() })
        ).not.toBeInTheDocument();
        await expect(
            screen.getByRole('button', { name: m.content_link_edit() })
        ).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div class="bg-background min-h-96 w-full p-6">
            <p class="text-foreground">
                See
                <!-- A span standing in for the editor's <a>: the card only needs
                     an element to anchor to, and a relative href here would be a
                     real navigation the router has not resolved. -->
                <span bind:this={relativeAnchor} class="text-primary underline"
                    >my notes</span
                >.
            </p>
            <LinkCard {...args} target={relativeTarget} />
        </div>
    {/snippet}
</Story>
