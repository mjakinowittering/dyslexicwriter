<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';

    import ToolbarLogo from '$lib/components/ContentEditor/Toolbar/ToolbarLogo.svelte';

    const { Story } = defineMeta({
        title: 'ContentEditor/Toolbar/ToolbarLogo',
        component: ToolbarLogo,
        tags: ['autodocs'],
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        "The app's logo column in the editor header — a full-height column sitting immediately right of the rail, sized by the same `px-3` gutter the title and toolbar rows use. Decorative only: no button, no tooltip, hidden from assistive technology."
                }
            }
        }
    });
</script>

<Story name="Default">
    {#snippet template()}
        <!-- Mimics the editor header band: the column stretches to the full
             height of the title row plus the toolbar row. -->
        <div class="bg-background w-full p-6">
            <div class="border-border flex h-24 border-b">
                <ToolbarLogo />
            </div>
        </div>
    {/snippet}
</Story>
