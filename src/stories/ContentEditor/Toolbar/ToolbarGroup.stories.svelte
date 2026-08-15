<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';

    import ToolbarGroup from '$lib/components/ContentEditor/Toolbar/ToolbarGroup.svelte';

    const { Story } = defineMeta({
        title: 'ContentEditor/Toolbar/ToolbarGroup',
        component: ToolbarGroup,
        tags: ['autodocs'],
        argTypes: {
            children: { control: false },
            class: { control: 'text' }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Generic layout box for a cluster of toolbar controls — a `div` that applies an optional `class` around its `children`.'
                }
            }
        }
    });
</script>

<Story name="Default" args={{ class: 'flex items-center gap-2' }}>
    {#snippet template({ children, ...args })}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToolbarGroup {...args}>
                <span class="rounded border px-2 py-1">A</span>
                <span class="rounded border px-2 py-1">B</span>
            </ToolbarGroup>
        </div>
    {/snippet}
</Story>
