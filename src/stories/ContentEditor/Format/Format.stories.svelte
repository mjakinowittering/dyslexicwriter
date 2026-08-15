<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';

    import Format from '$lib/components/ContentEditor/Format/Format.svelte';
    import FormatGroup from '$lib/components/ContentEditor/Format/FormatGroup.svelte';
    import FormatToggleBold from '$lib/components/ContentEditor/Format/FormatToggleBold.svelte';
    import FormatToggleItalic from '$lib/components/ContentEditor/Format/FormatToggleItalic.svelte';

    const { Story } = defineMeta({
        title: 'ContentEditor/Format/Format',
        component: Format,
        tags: ['autodocs'],
        argTypes: {
            children: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Formatting toolbar row wrapper — supplies the shared `Tooltip.Provider` and a horizontal flex layout for a set of format toggle groups.'
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
            <Format {...args}>
                <FormatGroup formatting={[]}>
                    <FormatToggleBold disabled={false} editor={undefined} />
                    <FormatToggleItalic disabled={false} editor={undefined} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>
