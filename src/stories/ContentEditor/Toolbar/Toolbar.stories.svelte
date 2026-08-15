<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';

    import Toolbar from '$lib/components/ContentEditor/Toolbar/Toolbar.svelte';

    const { Story } = defineMeta({
        title: 'ContentEditor/Toolbar/Toolbar',
        component: Toolbar,
        tags: ['autodocs'],
        argTypes: {
            children: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Top toolbar row of the content editor — a bordered horizontal flex container that lays out its `children` (title, save/discard, chat toggle).'
                }
            }
        }
    });
</script>

<Story name="Default">
    {#snippet template({ children, ...args })}
        <div class="bg-background min-h-96 w-full p-6">
            <Toolbar {...args}>
                <span class="font-semibold">Document title</span>
                <span class="text-muted-foreground ml-auto">Saved</span>
            </Toolbar>
        </div>
    {/snippet}
</Story>
