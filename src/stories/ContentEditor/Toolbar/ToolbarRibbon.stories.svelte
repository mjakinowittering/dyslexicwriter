<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';

    import ToolbarRibbon from '$lib/components/ContentEditor/Toolbar/ToolbarRibbon.svelte';

    const { Story } = defineMeta({
        title: 'ContentEditor/Toolbar/ToolbarRibbon',
        component: ToolbarRibbon,
        tags: ['autodocs'],
        argTypes: {
            children: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Formatting ribbon row beneath the toolbar — a bordered `nav` that lays out format toggle groups.'
                }
            }
        }
    });
</script>

<Story name="Default">
    {#snippet template({ children, ...args })}
        <div class="bg-background min-h-96 w-full p-6">
            <ToolbarRibbon {...args}>
                <span class="text-muted-foreground"
                    >Format controls go here</span
                >
            </ToolbarRibbon>
        </div>
    {/snippet}
</Story>
