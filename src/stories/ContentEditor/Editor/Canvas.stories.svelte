<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';

    import Canvas from '$lib/components/ContentEditor/Editor/Canvas.svelte';

    const { Story } = defineMeta({
        title: 'ContentEditor/Editor/Canvas',
        component: Canvas,
        tags: ['autodocs'],
        argTypes: {
            narrow: { control: 'boolean' },
            children: { control: false }
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

<Story name="Default" args={{ narrow: false }}>
    {#snippet template({ children, ...args })}
        <div class="flex h-screen w-full">
            <Canvas {...args}>
                <article class="prose dark:prose-invert">
                    <h1>Document title</h1>
                    <p>
                        The sheet holds the document at a comfortable measure
                        and gives up width only while the settings panel is
                        open.
                    </p>
                </article>
            </Canvas>
        </div>
    {/snippet}
</Story>

<Story name="Narrowed" args={{ narrow: true }}>
    {#snippet template({ children, ...args })}
        <div class="flex h-screen w-full">
            <Canvas {...args}>
                <article class="prose dark:prose-invert">
                    <h1>Document title</h1>
                    <p>Narrowed while the settings panel takes its column.</p>
                </article>
            </Canvas>
        </div>
    {/snippet}
</Story>

<!-- The page is continuous: past A4's height it keeps growing rather than
     breaking, so this story should scroll one long sheet, not two pages. -->
<Story name="Long document" args={{ narrow: false }}>
    {#snippet template({ children, ...args })}
        <div class="flex h-screen w-full">
            <Canvas {...args}>
                <article class="prose dark:prose-invert">
                    <h1>Document title</h1>
                    {#each { length: 40 }}
                        <p>
                            The page grows with the writing instead of breaking
                            into pages — A4 is the shape it starts at, not a
                            size it is ever cut to.
                        </p>
                    {/each}
                </article>
            </Canvas>
        </div>
    {/snippet}
</Story>
