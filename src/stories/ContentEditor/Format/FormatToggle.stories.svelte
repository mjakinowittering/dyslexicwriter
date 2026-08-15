<script lang="ts" module>
    import { TextBoldIcon } from '@hugeicons/core-free-icons';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, userEvent } from 'storybook/test';

    import Format from '$lib/components/ContentEditor/Format/Format.svelte';
    import FormatGroup from '$lib/components/ContentEditor/Format/FormatGroup.svelte';
    import FormatToggle from '$lib/components/ContentEditor/Format/FormatToggle.svelte';
    import Icon from '$lib/components/Icon/Icon.svelte';

    const { Story } = defineMeta({
        title: 'ContentEditor/Format/FormatToggle',
        component: FormatToggle,
        tags: ['autodocs'],
        argTypes: {
            children: { control: false },
            onClick: { control: false },
            disabled: { control: 'boolean' },
            ariaLabel: { control: 'text' },
            tooltip: { control: 'text' },
            value: { control: 'text' },
            shortcut: { control: 'object' }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Base toggle button used by every concrete format control — a `ToggleGroup.Item` wrapped in a tooltip that shows a label plus optional keyboard shortcut. The icon is supplied as children.'
                }
            }
        }
    });
</script>

<Story
    name="Default"
    args={{
        ariaLabel: 'Bold',
        disabled: false,
        onClick: fn(),
        tooltip: 'Bold',
        value: 'bold',
        shortcut: ['Ctrl', 'B']
    }}
    play={async ({ args, canvas }) => {
        await userEvent.click(canvas.getByRole('button', { name: 'Bold' }));
        await expect(args.onClick).toHaveBeenCalledOnce();
    }}
>
    {#snippet template({ children, ...args })}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup formatting={[]}>
                    <FormatToggle {...args}>
                        <Icon icon={TextBoldIcon} />
                    </FormatToggle>
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>

<Story
    name="Disabled"
    args={{
        ariaLabel: 'Bold',
        disabled: true,
        onClick: fn(),
        tooltip: 'Bold',
        value: 'bold'
    }}
    play={async ({ args, canvas }) => {
        const button = canvas.getByRole('button', { name: 'Bold' });
        await expect(button).toBeDisabled();
        await expect(args.onClick).not.toHaveBeenCalled();
    }}
>
    {#snippet template({ children, ...args })}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup formatting={[]}>
                    <FormatToggle {...args}>
                        <Icon icon={TextBoldIcon} />
                    </FormatToggle>
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>
