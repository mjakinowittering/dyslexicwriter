<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';

    import Page from '$lib/components/Editor/Page/Page.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Page/Page',
        component: Page,
        tags: ['autodocs'],
        argTypes: {
            narrow: { control: 'boolean' },
            reading: { control: 'boolean' },
            children: { control: false },
            onBackToTop: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The document sheet — a page with Google Docs-like margins (its own background, border, shadow) on a recessed canvas, running edge-to-edge below `sm`. It takes exactly the height the window leaves, so a short document never scrolls, then grows as one continuous page rather than breaking into pages. `narrow` mirrors the settings panel state: when set, the sheet tweens to a slightly tighter measure via a native `Tween` (persistent element, so no `transition:`).'
                }
            }
        }
    });
</script>

<!-- The canvas scrolls once the sheet overflows it, so something inside has to be
     reachable from the keyboard, or a keyboard user cannot scroll the page at all.
     `Page` itself is correct and is left alone: it is only ever given
     `Page.Editor`, and these stories stand in prose of their own.

     So the stand-in is shaped like the real thing — the contenteditable,
     `role="textbox"` and label TipTap renders (see `PageEditor.svelte`). The
     explicit `tabindex` is the part that does the work: axe does not count a bare
     contenteditable as tabbable content, so without it the long story fails
     `scrollable-region-focusable` even though the element is focusable in practice. -->

<Story name="Default" args={{ narrow: false }}>
    {#snippet template({ children, ...args })}
        <div class="flex h-screen w-full">
            <Page {...args}>
                <div
                    aria-label={m.content_editor_label()}
                    class="prose dark:prose-invert"
                    contenteditable="true"
                    role="textbox"
                    tabindex="0"
                >
                    <h1>Document title</h1>
                    <p>
                        The sheet holds the document at a comfortable measure
                        and gives up width only while the settings panel is
                        open.
                    </p>
                </div>
            </Page>
        </div>
    {/snippet}
</Story>

<Story name="Narrowed" args={{ narrow: true }}>
    {#snippet template({ children, ...args })}
        <div class="flex h-screen w-full">
            <Page {...args}>
                <div
                    aria-label={m.content_editor_label()}
                    class="prose dark:prose-invert"
                    contenteditable="true"
                    role="textbox"
                    tabindex="0"
                >
                    <h1>Document title</h1>
                    <p>Narrowed while the settings panel takes its column.</p>
                </div>
            </Page>
        </div>
    {/snippet}
</Story>

<!-- The page is continuous: past A4's height it keeps growing rather than
     breaking, so this story should scroll one long sheet, not two pages.

     `reading` is set, so scrolling this one past the first screen brings up the
     back-to-top button read-aloud offers once it has followed the voice down. -->
<Story name="Long document" args={{ narrow: false, reading: true }}>
    {#snippet template({ children, ...args })}
        <div class="flex h-screen w-full">
            <Page {...args}>
                <div
                    aria-label={m.content_editor_label()}
                    class="prose dark:prose-invert"
                    contenteditable="true"
                    role="textbox"
                    tabindex="0"
                >
                    <h1>Document title</h1>
                    {#each { length: 40 }}
                        <p>
                            The page grows with the writing instead of breaking
                            into pages — A4 is the shape it starts at, not a
                            size it is ever cut to.
                        </p>
                    {/each}
                </div>
            </Page>
        </div>
    {/snippet}
</Story>
