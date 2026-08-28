<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn } from 'storybook/test';

    import Format from '$lib/components/Editor/Format/Format.svelte';
    import FormatGroup from '$lib/components/Editor/Format/FormatGroup.svelte';
    import FormatInsertImage from '$lib/components/Editor/Format/FormatInsertImage.svelte';
    import FormatInsertTable from '$lib/components/Editor/Format/FormatInsertTable.svelte';
    import FormatToggleBold from '$lib/components/Editor/Format/FormatToggleBold.svelte';
    import FormatToggleItalic from '$lib/components/Editor/Format/FormatToggleItalic.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Format/FormatGroup',
        component: FormatGroup,
        tags: ['autodocs'],
        argTypes: {
            children: { control: false },
            // Bindable, so it is driven by a local binding below rather than by an
            // arg — Storybook args are one-way, and a literal here is passed on to
            // ToggleGroup.Root with `bind:`, which warns.
            formatting: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Groups related toolbar controls. With `formatting` it is a multi-select `ToggleGroup.Root` binding its pressed values, so toggles (e.g. bold/italic) reflect the current selection; without it the group renders insert actions as plain buttons in a `ButtonGroup.Root`. Anything built on `FormatToggle` needs the toggle-group form — a `ToggleGroup.Item` with no root above it throws.'
                }
            }
        }
    });
</script>

<script lang="ts">
    // The pressed state each story pins, held locally so the group can bind it.
    let none = $state<string[]>([]);
    let bold = $state(['bold']);
</script>

<Story
    name="Default"
    play={async ({ canvas }) => {
        for (const name of [
            m.content_format_bold(),
            m.content_format_italic()
        ]) {
            await expect(canvas.getByRole('button', { name })).toHaveAttribute(
                'data-state',
                'off'
            );
        }
    }}
>
    {#snippet template({ children, ...args })}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup {...args} bind:formatting={none}>
                    <FormatToggleBold disabled={false} editor={undefined} />
                    <FormatToggleItalic disabled={false} editor={undefined} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>

<Story
    name="Bold Active"
    play={async ({ canvas }) => {
        // One value in `formatting` lights one button and leaves its neighbour alone.
        await expect(
            canvas.getByRole('button', { name: m.content_format_bold() })
        ).toHaveAttribute('data-state', 'on');
        await expect(
            canvas.getByRole('button', { name: m.content_format_italic() })
        ).toHaveAttribute('data-state', 'off');
    }}
>
    {#snippet template({ children, ...args })}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup {...args} bind:formatting={bold}>
                    <FormatToggleBold disabled={false} editor={undefined} />
                    <FormatToggleItalic disabled={false} editor={undefined} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>

<!-- No `formatting`, so the group renders insert actions as plain buttons. Only
     controls built on `FormatInsert` belong here — `FormatInsertHorizontalRule` is
     a toggle underneath, and would find no ToggleGroup root to register with. -->
<Story
    name="Insert Actions"
    play={async ({ canvas }) => {
        for (const name of [
            m.content_format_table(),
            m.content_format_image()
        ]) {
            const button = canvas.getByRole('button', { name });
            await expect(button).toBeEnabled();
            // Plain buttons: no pressed state to report at all.
            await expect(button).not.toHaveAttribute('aria-pressed');
        }
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup>
                    <FormatInsertTable disabled={false} editor={undefined} />
                    <FormatInsertImage
                        disabled={false}
                        editor={undefined}
                        onPick={fn(async () => null)}
                    />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>
