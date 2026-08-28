<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import Format from '$lib/components/Editor/Format/Format.svelte';
    import FormatGroup from '$lib/components/Editor/Format/FormatGroup.svelte';
    import FormatInsertHorizontalRule from '$lib/components/Editor/Format/FormatInsertHorizontalRule.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Format/FormatInsertHorizontalRule',
        component: FormatInsertHorizontalRule,
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
                        'Horizontal-rule insert button. Inserts a divider at the cursor, so it never holds a pressed state — but it is built on `FormatToggle`, so it needs a group **with** `formatting` around it, the way the editor toolbar places it beside Blockquote. Shown without a live editor, so clicks are no-ops.'
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

<Story
    name="Default"
    args={{ disabled: false, editor: undefined }}
    play={async ({ canvas }) => {
        const rule = canvas.getByRole('button', {
            name: m.content_format_horizontal_rule()
        });
        await expect(rule).toBeEnabled();
        // Inserting is one-shot: "horizontalRule" never enters the pressed array.
        await expect(rule).toHaveAttribute('data-state', 'off');
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup bind:formatting={none}>
                    <FormatInsertHorizontalRule {...args} />
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
                name: m.content_format_horizontal_rule()
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
                    <FormatInsertHorizontalRule {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>
