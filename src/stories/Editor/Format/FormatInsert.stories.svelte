<script lang="ts" module>
    import { TableIcon } from '@hugeicons/core-free-icons';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, userEvent } from 'storybook/test';

    import Format from '$lib/components/Editor/Format/Format.svelte';
    import FormatGroup from '$lib/components/Editor/Format/FormatGroup.svelte';
    import FormatInsert from '$lib/components/Editor/Format/FormatInsert.svelte';
    import Icon from '$lib/components/Icon/Icon.svelte';

    const { Story } = defineMeta({
        title: 'Editor/Format/FormatInsert',
        component: FormatInsert,
        tags: ['autodocs'],
        argTypes: {
            children: { control: false },
            onClick: { control: false },
            disabled: { control: 'boolean' },
            ariaLabel: { control: 'text' },
            tooltip: { control: 'text' },
            shortcut: { control: 'object' }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Base button used by every insert control — a plain `Button` wrapped in a tooltip that shows a label plus optional keyboard shortcut. Unlike `FormatToggle` it holds no pressed state, because inserting is a one-shot action. The icon is supplied as children.'
                }
            }
        }
    });
</script>

<Story
    name="Default"
    args={{
        ariaLabel: 'Table',
        disabled: false,
        onClick: fn(),
        tooltip: 'Insert a table'
    }}
    play={async ({ args, canvas }) => {
        const button = canvas.getByRole('button', { name: 'Table' });
        // One-shot: a plain button, so there is no pressed state to carry.
        await expect(button).not.toHaveAttribute('aria-pressed');

        await userEvent.click(button);
        await expect(args.onClick).toHaveBeenCalledOnce();
    }}
>
    {#snippet template({ children, ...args })}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup>
                    <FormatInsert {...args}>
                        <Icon icon={TableIcon} />
                    </FormatInsert>
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>

<Story
    name="Disabled"
    args={{
        ariaLabel: 'Table',
        disabled: true,
        onClick: fn(),
        tooltip: 'Insert a table'
    }}
    play={async ({ args, canvas }) => {
        await expect(
            canvas.getByRole('button', { name: 'Table' })
        ).toBeDisabled();
        await expect(args.onClick).not.toHaveBeenCalled();
    }}
>
    {#snippet template({ children, ...args })}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup>
                    <FormatInsert {...args}>
                        <Icon icon={TableIcon} />
                    </FormatInsert>
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>
