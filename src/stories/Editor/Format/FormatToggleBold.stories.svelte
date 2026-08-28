<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import Format from '$lib/components/Editor/Format/Format.svelte';
    import FormatGroup from '$lib/components/Editor/Format/FormatGroup.svelte';
    import FormatToggleBold from '$lib/components/Editor/Format/FormatToggleBold.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Format/FormatToggleBold',
        component: FormatToggleBold,
        tags: ['autodocs'],
        argTypes: {
            editor: { control: false },
            disabled: { control: 'boolean' }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Bold format toggle (Ctrl+B). Toggling applies bold to the current selection via `toggleWithWordBoundary`. Shown here without a live editor, so clicks are no-ops.'
                }
            }
        }
    });
</script>

<script lang="ts">
    // `formatting` is bindable and is passed on to ToggleGroup.Root with `bind:`,
    // so a literal warns. These pin the pressed state each story shows.
    let none = $state<string[]>([]);
    let bold = $state(['bold']);
</script>

<Story
    name="Default"
    args={{ disabled: false, editor: undefined }}
    play={async ({ canvas }) => {
        const bold = canvas.getByRole('button', {
            name: m.content_format_bold()
        });
        await expect(bold).toBeEnabled();
        // Pressed state comes from the group's `formatting`, never from the click.
        await expect(bold).toHaveAttribute('data-state', 'off');
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup bind:formatting={none}>
                    <FormatToggleBold {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>

<!-- The selection is bold: the group reports it, so the button lights. -->
<Story
    name="Active"
    args={{ disabled: false, editor: undefined }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_format_bold() })
        ).toHaveAttribute('data-state', 'on');
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup bind:formatting={bold}>
                    <FormatToggleBold {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>

<Story
    name="Disabled"
    args={{ disabled: true, editor: undefined }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_format_bold() })
        ).toBeDisabled();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup bind:formatting={none}>
                    <FormatToggleBold {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>
