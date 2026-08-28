<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import Format from '$lib/components/Editor/Format/Format.svelte';
    import FormatGroup from '$lib/components/Editor/Format/FormatGroup.svelte';
    import FormatToggleOrderedList from '$lib/components/Editor/Format/FormatToggleOrderedList.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Format/FormatToggleOrderedList',
        component: FormatToggleOrderedList,
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
                        'Ordered-list format toggle. Converts the current block into a numbered list. Shown without a live editor, so clicks are no-ops.'
                }
            }
        }
    });
</script>

<script lang="ts">
    // `formatting` is bindable and is passed on to ToggleGroup.Root with `bind:`,
    // so a literal warns. These pin the pressed state each story shows.
    let none = $state<string[]>([]);
    let orderedList = $state(['orderedList']);
</script>

<Story
    name="Default"
    args={{ disabled: false, editor: undefined }}
    play={async ({ canvas }) => {
        const button = canvas.getByRole('button', {
            name: m.content_format_ordered_list()
        });
        await expect(button).toBeEnabled();
        // Pressed state comes from the group's `formatting`, never from the click.
        await expect(button).toHaveAttribute('data-state', 'off');
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup bind:formatting={none}>
                    <FormatToggleOrderedList {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>

<!-- The cursor is inside a numbered list, so the button lights. -->
<Story
    name="Active"
    args={{ disabled: false, editor: undefined }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', {
                name: m.content_format_ordered_list()
            })
        ).toHaveAttribute('data-state', 'on');
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup bind:formatting={orderedList}>
                    <FormatToggleOrderedList {...args} />
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
            canvas.getByRole('button', {
                name: m.content_format_ordered_list()
            })
        ).toBeDisabled();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup bind:formatting={none}>
                    <FormatToggleOrderedList {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>
