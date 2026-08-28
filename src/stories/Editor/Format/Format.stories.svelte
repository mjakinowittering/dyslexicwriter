<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';

    import Format from '$lib/components/Editor/Format/Format.svelte';
    import FormatGroup from '$lib/components/Editor/Format/FormatGroup.svelte';
    import FormatToggleBold from '$lib/components/Editor/Format/FormatToggleBold.svelte';
    import FormatToggleItalic from '$lib/components/Editor/Format/FormatToggleItalic.svelte';

    const { Story } = defineMeta({
        title: 'Editor/Format/Format',
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

<script lang="ts">
    // `formatting` is bindable and is passed on to ToggleGroup.Root with `bind:`,
    // so a literal warns. These pin the pressed state each story shows.
    let none = $state<string[]>([]);
</script>

<Story name="Default">
    {#snippet template({ children, ...args })}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format {...args}>
                <FormatGroup bind:formatting={none}>
                    <FormatToggleBold disabled={false} editor={undefined} />
                    <FormatToggleItalic disabled={false} editor={undefined} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>
