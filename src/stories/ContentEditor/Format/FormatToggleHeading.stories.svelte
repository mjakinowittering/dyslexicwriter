<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import Format from '$lib/components/ContentEditor/Format/Format.svelte';
    import FormatGroup from '$lib/components/ContentEditor/Format/FormatGroup.svelte';
    import FormatToggleHeading from '$lib/components/ContentEditor/Format/FormatToggleHeading.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'ContentEditor/Format/FormatToggleHeading',
        component: FormatToggleHeading,
        tags: ['autodocs'],
        argTypes: {
            editor: { control: false },
            disabled: { control: 'boolean' },
            level: { control: 'inline-radio', options: [1, 2, 3, 4] }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Heading format toggle (Ctrl+Alt+level). Renders the H1–H4 icon for the given `level` and toggles that heading level. Shown without a live editor, so clicks are no-ops.'
                }
            }
        }
    });
</script>

<Story
    name="Heading 1"
    args={{ disabled: false, editor: undefined, level: 1 }}
    play={async ({ canvas }) => {
        // Each level is its own toggle value (`heading1`…`heading4`), so the label
        // has to name the level too.
        await expect(
            canvas.getByRole('button', {
                name: m.content_format_heading({ level: 1 })
            })
        ).toHaveAttribute('data-state', 'off');
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup formatting={[]}>
                    <FormatToggleHeading {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>

<Story name="Heading 2" args={{ disabled: false, editor: undefined, level: 2 }}>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup formatting={[]}>
                    <FormatToggleHeading {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>

<!-- The cursor is in an H2, so only that level lights. -->
<Story
    name="Active"
    args={{ disabled: false, editor: undefined, level: 2 }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', {
                name: m.content_format_heading({ level: 2 })
            })
        ).toHaveAttribute('data-state', 'on');
        await expect(
            canvas.getByRole('button', {
                name: m.content_format_heading({ level: 1 })
            })
        ).toHaveAttribute('data-state', 'off');
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup formatting={['heading2']}>
                    <FormatToggleHeading
                        disabled={false}
                        editor={undefined}
                        level={1}
                    />
                    <FormatToggleHeading {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>

<Story
    name="All Levels"
    play={async ({ canvas }) => {
        for (const level of [1, 2, 3, 4]) {
            await expect(
                canvas.getByRole('button', {
                    name: m.content_format_heading({ level })
                })
            ).toBeEnabled();
        }
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup formatting={[]}>
                    <FormatToggleHeading
                        disabled={false}
                        editor={undefined}
                        level={1}
                    />
                    <FormatToggleHeading
                        disabled={false}
                        editor={undefined}
                        level={2}
                    />
                    <FormatToggleHeading
                        disabled={false}
                        editor={undefined}
                        level={3}
                    />
                    <FormatToggleHeading
                        disabled={false}
                        editor={undefined}
                        level={4}
                    />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>
