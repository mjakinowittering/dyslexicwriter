<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';

    import ToolbarTitle from '$lib/components/Editor/Toolbar/ToolbarTitle.svelte';

    const { Story } = defineMeta({
        title: 'Editor/Toolbar/ToolbarTitle',
        component: ToolbarTitle,
        tags: ['autodocs'],
        argTypes: {
            children: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Width-capped container for the document title/name in the toolbar (max-w-sm), so long titles truncate rather than push the controls.'
                }
            }
        }
    });
</script>

<Story name="Default">
    {#snippet template({ children, ...args })}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToolbarTitle {...args}>
                <span class="truncate font-semibold">
                    A rather long document title that should stay within its box
                </span>
            </ToolbarTitle>
        </div>
    {/snippet}
</Story>
